const express = require("express");
const cors = require("cors");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const validator = require("validator");
const rateLimit = require("express-rate-limit");
const { criarToken, verificarToken } = require("./auth");
const axios = require("axios");
const db = require("./database");

const app = express();
// O Render fica atrás de um proxy; isso permite que o rate-limit identifique o IP real.
app.set("trust proxy", 1);
// Restringe quem pode chamar a API à origem do frontend (definida no .env).
// Sem FRONTEND_URL configurada, libera geral (útil em dev).
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
// Limita o tamanho do corpo JSON; nenhuma rota precisa de mais que isso.
app.use(express.json({ limit: "10kb" }));

// Limita tentativas de registro/login: no máximo 10 por IP a cada 15 minutos.
// Evita spam de cadastros e ataques de força bruta.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas. Tente novamente em 15 minutos." },
});

// Limita o envio de palpites: no máximo 30 por IP por minuto. Evita que um
// usuário logado floode o banco com requisições repetidas.
const palpiteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitos palpites em pouco tempo. Aguarde um instante." },
});

// Limita operações de grupo que escrevem no banco (criar/entrar): no máximo
// 20 por IP por minuto. Evita criação em massa de grupos e spam de entradas.
const gruposLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas operações em pouco tempo. Aguarde um instante." },
});

// Protege rotas administrativas (ex: processar resultado de um jogo).
// Exige o header x-admin-secret igual ao ADMIN_SECRET do .env.
function verificarAdmin(req, res, next) {
  const segredo = req.headers["x-admin-secret"];
  if (!process.env.ADMIN_SECRET || segredo !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ erro: "Acesso negado" });
  }
  next();
}

// jogoId precisa ser um inteiro positivo. Evita 500 com lixo e impede
// manipulação do path na chamada à API externa (ex: "../../algo").
function jogoIdValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0;
}

// Valida ids vindos do path (grupo, usuário): inteiro positivo. Evita 500
// com lixo e injeção de valores inesperados na query.
function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0;
}

// Gera um código de convite curto e legível. Omitimos caracteres ambíguos
// (0/O, 1/I) para facilitar o compartilhamento verbal/escrito entre amigos.
function gerarCodigoConvite(tamanho = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "";
  for (let i = 0; i < tamanho; i++) {
    codigo += chars[Math.floor(Math.random() * chars.length)];
  }
  return codigo;
}

// Diz se um usuário participa de um grupo. Usado para garantir que só
// membros consigam ver/agir sobre o grupo.
async function ehMembroDoGrupo(grupoId, usuarioId) {
  const resultado = await db.execute({
    sql: "SELECT 1 FROM grupo_membros WHERE grupo_id = ? AND usuario_id = ?",
    args: [grupoId, usuarioId],
  });
  return resultado.rows.length > 0;
}

// Cache simples em memória dos jogos para não bater na API externa a cada request.
let jogosCache = { dados: null, expira: 0 };

async function buscarJogos() {
  if (jogosCache.dados && jogosCache.expira > Date.now()) {
    return jogosCache.dados;
  }

  const response = await axios.get(
    `${process.env.FOOTBALL_API_URL}/competitions/WC/matches`,
    { headers: { "X-Auth-Token": process.env.FOOTBALL_API_KEY } },
  );

  const jogos = response.data.matches.map((jogo) => ({
    id: jogo.id,
    data: jogo.utcDate,
    grupo: jogo.group,
    casa: jogo.homeTeam.name,
    casaEscudo: jogo.homeTeam.crest,
    fora: jogo.awayTeam.name,
    foraEscudo: jogo.awayTeam.crest,
    placarCasa: jogo.score.fullTime.home,
    placarFora: jogo.score.fullTime.away,
  }));

  jogosCache = { dados: jogos, expira: Date.now() + 5 * 60 * 1000 };
  return jogos;
}

app.get("/", (req, res) => {
  res.json({ mensagem: "Bolao copa API func" });
});

app.get("/api/jogos", async (req, res) => {
  try {
    const jogos = await buscarJogos();
    res.json(jogos);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ erro: "Erro ao buscar jogos" });
  }
});

// Valida um placar: precisa ser inteiro, entre 0 e 20 (no máx. 2 dígitos e
// dentro de um limite realista de futebol). Acima disso é abuso/erro.
function placarValido(valor) {
  return Number.isInteger(valor) && valor >= 0 && valor <= 20;
}

// Antecedência mínima (em ms) para aceitar/alterar um palpite. Os palpites
// fecham 5 minutos antes do horário marcado do jogo.
const ANTECEDENCIA_MINIMA_MS = 5 * 60 * 1000;

// Diz se o palpite ainda pode ser enviado/editado, comparando o horário
// (utcDate) do jogo com o instante atual. Fecha 5 min antes do início.
function palpitesEncerrados(dataDoJogo) {
  if (!dataDoJogo) return false;
  const inicio = new Date(dataDoJogo).getTime();
  if (Number.isNaN(inicio)) return false;
  return Date.now() >= inicio - ANTECEDENCIA_MINIMA_MS;
}

app.post("/api/palpites", palpiteLimiter, verificarToken, async (req, res) => {
  const { jogoId, placarCasa, placarFora } = req.body;
  const usuarioId = req.usuario.id;

  if (!placarValido(placarCasa) || !placarValido(placarFora)) {
    return res.status(400).json({
      erro: "Placar inválido: use números inteiros entre 0 e 20 gols",
    });
  }

  try {
    // Valida o jogo contra a lista oficial da API (servida pelo cache, que
    // se atualiza a cada 5 min para não estourar o rate limit). Isso evita
    // palpites em jogoId inventado e bloqueia jogos já iniciados.
    let jogos;
    try {
      jogos = await buscarJogos();
    } catch (error) {
      console.error("Não foi possível verificar o jogo:", error.message);
      return res
        .status(503)
        .json({ erro: "Não foi possível validar o jogo, tente novamente" });
    }

    const jogo = jogos.find((j) => j.id === Number(jogoId));
    if (!jogo) {
      return res.status(400).json({ erro: "Jogo inválido" });
    }
    if (jogo.placarCasa !== null) {
      return res
        .status(400)
        .json({ erro: "Jogo já iniciado, não é possível alterar o palpite" });
    }
    // Backend é a fonte de verdade: mesmo se a validação do frontend for
    // burlada, rejeitamos palpites a menos de 5 min do início do jogo.
    if (palpitesEncerrados(jogo.data)) {
      return res
        .status(400)
        .json({ erro: "Palpites encerrados para esse jogo" });
    }

    // Um palpite por jogo por usuário: se já existe, atualizamos em vez de criar.
    // Usa jogo.id (já validado e numérico) para manter o tipo consistente.
    const existente = await db.execute({
      sql: "SELECT id FROM palpites WHERE usuarioId = ? AND jogoId = ?",
      args: [usuarioId, jogo.id],
    });

    if (existente.rows.length > 0) {
      const id = existente.rows[0].id;
      await db.execute({
        sql: "UPDATE palpites SET placarCasa = ?, placarFora = ? WHERE id = ?",
        args: [placarCasa, placarFora, id],
      });
      return res.json({ mensagem: "Palpite atualizado", id: Number(id) });
    }

    const resultado = await db.execute({
      sql: "INSERT INTO palpites (usuarioId, jogoId, placarCasa, placarFora) VALUES (?, ?, ?, ?)",
      args: [usuarioId, jogo.id, placarCasa, placarFora],
    });
    res.json({
      mensagem: "Palpite registrado",
      id: Number(resultado.lastInsertRowid),
    });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao salvar palpite" });
  }
});

app.get("/api/palpites", verificarToken, async (req, res) => {
  const usuarioId = req.usuario.id;

  try {
    const resultado = await db.execute({
      sql: "SELECT * FROM palpites WHERE usuarioId = ?",
      args: [usuarioId],
    });
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar palpites" });
  }
});

// Placar mais "cravado" pela galera em cada jogo (a moda dos palpites).
// Read-only e 100% agregado: não expõe palpites individuais nem usuários, e
// não toca na lógica de pontuação. Alimenta o "a galera crava X×Y" dos cards.
// Público como /api/jogos (só devolve contagens, não dados sensíveis).
app.get("/api/palpites/populares", async (req, res) => {
  try {
    const resultado = await db.execute(`
      SELECT jogoId, placarCasa, placarFora, COUNT(*) AS total
      FROM palpites
      GROUP BY jogoId, placarCasa, placarFora
    `);

    // Para cada jogo, fica com o placar de maior contagem. A query já vem
    // agrupada; aqui só reduzimos ao mais votado por jogo (desempate: o
    // primeiro que aparecer, comportamento estável o suficiente para exibição).
    const porJogo = new Map();
    for (const linha of resultado.rows) {
      const total = Number(linha.total);
      const atual = porJogo.get(linha.jogoId);
      if (!atual || total > atual.total) {
        porJogo.set(linha.jogoId, {
          jogoId: Number(linha.jogoId),
          placarCasa: Number(linha.placarCasa),
          placarFora: Number(linha.placarFora),
          total,
        });
      }
    }

    res.json([...porJogo.values()]);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar palpites populares" });
  }
});

app.post("/api/registro", authLimiter, async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: "Preencha todos os campos" });
  }
  if (typeof nome !== "string" || nome.length > 100) {
    return res
      .status(400)
      .json({ erro: "Nome deve ter no máximo 100 caracteres" });
  }
  if (typeof email !== "string" || email.length > 150) {
    return res
      .status(400)
      .json({ erro: "Email deve ter no máximo 150 caracteres" });
  }
  if (typeof senha !== "string" || senha.length < 6 || senha.length > 72) {
    return res
      .status(400)
      .json({ erro: "Senha deve ter entre 6 e 72 caracteres" });
  }
  if (!validator.isEmail(email)) {
    return res.status(400).json({ erro: "Email invalido" });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const resultado = await db.execute({
      sql: "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)",
      args: [nome, email, senhaHash],
    });
    res.json({
      mensagem: "Usuario criado!",
      id: Number(resultado.lastInsertRowid),
    });
  } catch (error) {
    res.status(400).json({ erro: "Email ja cadastrado" });
  }
});

app.post("/api/login", authLimiter, async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: "Preencha email e senha" });
  }
  if (typeof email !== "string" || email.length > 150) {
    return res
      .status(400)
      .json({ erro: "Email deve ter no máximo 150 caracteres" });
  }
  if (typeof senha !== "string" || senha.length < 6 || senha.length > 72) {
    return res
      .status(400)
      .json({ erro: "Senha deve ter entre 6 e 72 caracteres" });
  }

  try {
    const resultado = await db.execute({
      sql: "SELECT * FROM usuarios WHERE email = ?",
      args: [email],
    });
    const usuario = resultado.rows[0];

    if (!usuario) {
      return res.status(401).json({ erro: "Email ou Senha invalidos" });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: "Email ou Senha invalidos" });
    }

    const token = criarToken(usuario);
    res.json({ mensagem: "Login realizado!", token });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao fazer login" });
  }
});

app.get("/api/pontuacao/:jogoId", verificarToken, async (req, res) => {
  const { jogoId } = req.params;
  const usuarioId = req.usuario.id;

  if (!jogoIdValido(jogoId)) {
    return res.status(400).json({ erro: "Jogo inválido" });
  }

  try {
    const resultadoPalpite = await db.execute({
      sql: "SELECT * FROM palpites WHERE jogoId = ? AND usuarioId = ?",
      args: [Number(jogoId), usuarioId],
    });
    const palpite = resultadoPalpite.rows[0];

    if (!palpite) {
      return res.status(404).json({ erro: "Palpite não encontrado" });
    }

    // Usa o cache de jogos em vez de bater na API externa a cada request,
    // evitando estourar a cota do football-data.org.
    const jogos = await buscarJogos();
    const jogo = jogos.find((j) => j.id === Number(jogoId));
    if (!jogo) {
      return res.status(404).json({ erro: "Jogo não encontrado" });
    }

    const placarCasaReal = jogo.placarCasa;
    const placarForaReal = jogo.placarFora;

    if (placarCasaReal === null || placarForaReal === null) {
      return res.json({ mensagem: "Jogo ainda não terminou", pontos: 0 });
    }

    let pontos = 0;

    const acertouPlacar =
      palpite.placarCasa === placarCasaReal &&
      palpite.placarFora === placarForaReal;

    const resultadoCalc = Math.sign(palpite.placarCasa - palpite.placarFora);
    const resultadoReal = Math.sign(placarCasaReal - placarForaReal);
    const acertouResultado = resultadoCalc === resultadoReal;

    if (acertouPlacar) {
      pontos = 10;
    } else if (acertouResultado) {
      pontos = 5;
    }

    res.json({
      pontos,
      acertouPlacar,
      acertouResultado,
      placarReal: { casa: placarCasaReal, fora: placarForaReal },
      palpite: { casa: palpite.placarCasa, fora: palpite.placarFora },
    });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar resultado do jogo" });
  }
});

app.post("/api/processar-jogo/:jogoId", verificarAdmin, async (req, res) => {
  const { jogoId } = req.params;

  if (!jogoIdValido(jogoId)) {
    return res.status(400).json({ erro: "Jogo inválido" });
  }

  try {
    const response = await axios.get(
      `${process.env.FOOTBALL_API_URL}/matches/${Number(jogoId)}`,
      { headers: { "X-Auth-Token": process.env.FOOTBALL_API_KEY } },
    );

    const placarCasaReal = response.data.score.fullTime.home;
    const placarForaReal = response.data.score.fullTime.away;

    if (placarCasaReal === null || placarForaReal === null) {
      return res.json({ mensagem: "Jogo ainda não terminou" });
    }

    const resultadoReal = Math.sign(placarCasaReal - placarForaReal);

    const resultadoPalpites = await db.execute({
      sql: "SELECT * FROM palpites WHERE jogoId = ?",
      args: [Number(jogoId)],
    });
    const palpites = resultadoPalpites.rows;

    if (palpites.length === 0) {
      return res
        .status(404)
        .json({ erro: "Nenhum palpite encontrado para esse jogo" });
    }

    const acertaram = [];
    const erraram = [];

    palpites.forEach((palpite) => {
      const resultadoPalpite = Math.sign(
        palpite.placarCasa - palpite.placarFora,
      );
      const acertouPlacar =
        palpite.placarCasa === placarCasaReal &&
        palpite.placarFora === placarForaReal;
      const acertouResultado = resultadoPalpite === resultadoReal;

      let pontosBase = 0;
      if (acertouPlacar) pontosBase = 10;
      else if (acertouResultado) pontosBase = 5;

      if (acertouResultado) {
        acertaram.push({ ...palpite, pontosBase });
      } else {
        erraram.push({ ...palpite, pontosBase: -3 });
      }
    });

    const totalPerdido = erraram.length * 3;
    const bonusPorAcerto =
      acertaram.length > 0 ? totalPerdido / acertaram.length : 0;

    const atualizacoes = [];

    acertaram.forEach((p) => {
      const pontosFinal = p.pontosBase + bonusPorAcerto;
      atualizacoes.push({ id: p.id, pontos: pontosFinal });
    });

    erraram.forEach((p) => {
      atualizacoes.push({ id: p.id, pontos: p.pontosBase });
    });

    for (const u of atualizacoes) {
      await db.execute({
        sql: "UPDATE palpites SET pontos = ? WHERE id = ?",
        args: [u.pontos, u.id],
      });
    }

    res.json({ mensagem: "Jogo processado!", resultados: atualizacoes });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao processar jogo" });
  }
});

app.get("/api/ranking", async (req, res) => {
  try {
    const resultado = await db.execute(`
      SELECT usuarios.id, usuarios.nome, SUM(palpites.pontos) as totalPontos
      FROM usuarios
      LEFT JOIN palpites ON usuarios.id = palpites.usuarioId
      GROUP BY usuarios.id
      ORDER BY totalPontos DESC
    `);
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar ranking" });
  }
});

// ---------------------------------------------------------------------------
// GRUPOS DE PALPITES
// Grupos privados onde amigos competem num ranking separado do ranking geral.
// Todas as rotas exigem login e só permitem agir sobre grupos dos quais o
// usuário é membro.
// ---------------------------------------------------------------------------

// Cria um grupo. O usuário logado vira criador e primeiro membro.
app.post("/api/grupos", gruposLimiter, verificarToken, async (req, res) => {
  const { nome } = req.body;
  const usuarioId = req.usuario.id;

  if (typeof nome !== "string" || nome.trim().length === 0) {
    return res.status(400).json({ erro: "Informe o nome do grupo" });
  }
  const nomeLimpo = nome.trim();
  if (nomeLimpo.length > 50) {
    return res
      .status(400)
      .json({ erro: "Nome do grupo deve ter no máximo 50 caracteres" });
  }

  try {
    // Gera um código único: tenta algumas vezes caso esbarre num já existente.
    let codigo = null;
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const candidato = gerarCodigoConvite();
      const existe = await db.execute({
        sql: "SELECT 1 FROM grupos WHERE codigo_convite = ?",
        args: [candidato],
      });
      if (existe.rows.length === 0) {
        codigo = candidato;
        break;
      }
    }
    if (!codigo) {
      return res
        .status(500)
        .json({ erro: "Não foi possível gerar o código, tente de novo" });
    }

    const resultado = await db.execute({
      sql: "INSERT INTO grupos (nome, codigo_convite, criador_id) VALUES (?, ?, ?)",
      args: [nomeLimpo, codigo, usuarioId],
    });
    const grupoId = Number(resultado.lastInsertRowid);

    await db.execute({
      sql: "INSERT INTO grupo_membros (grupo_id, usuario_id) VALUES (?, ?)",
      args: [grupoId, usuarioId],
    });

    res.json({
      mensagem: "Grupo criado",
      id: grupoId,
      nome: nomeLimpo,
      codigoConvite: codigo,
    });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao criar grupo" });
  }
});

// Entra num grupo usando o código de convite.
app.post(
  "/api/grupos/entrar",
  gruposLimiter,
  verificarToken,
  async (req, res) => {
    const { codigo } = req.body;
    const usuarioId = req.usuario.id;

    if (typeof codigo !== "string" || codigo.trim().length === 0) {
      return res.status(400).json({ erro: "Informe o código de convite" });
    }
    const codigoLimpo = codigo.trim().toUpperCase();
    if (codigoLimpo.length > 20) {
      return res.status(400).json({ erro: "Código de convite inválido" });
    }

    try {
      const grupoRes = await db.execute({
        sql: "SELECT * FROM grupos WHERE codigo_convite = ?",
        args: [codigoLimpo],
      });
      const grupo = grupoRes.rows[0];
      if (!grupo) {
        return res.status(404).json({ erro: "Código de convite inválido" });
      }

      if (await ehMembroDoGrupo(grupo.id, usuarioId)) {
        return res.status(409).json({ erro: "Você já está nesse grupo" });
      }

      await db.execute({
        sql: "INSERT INTO grupo_membros (grupo_id, usuario_id) VALUES (?, ?)",
        args: [grupo.id, usuarioId],
      });

      res.json({
        mensagem: "Você entrou no grupo",
        id: Number(grupo.id),
        nome: grupo.nome,
      });
    } catch (error) {
      res.status(500).json({ erro: "Erro ao entrar no grupo" });
    }
  },
);

// Lista os grupos dos quais o usuário logado participa.
app.get("/api/grupos/meus", verificarToken, async (req, res) => {
  const usuarioId = req.usuario.id;

  try {
    const resultado = await db.execute({
      sql: `SELECT grupos.id, grupos.nome,
                   grupos.codigo_convite AS codigoConvite,
                   grupos.criador_id AS criadorId,
                   (SELECT COUNT(*) FROM grupo_membros
                    WHERE grupo_id = grupos.id) AS totalMembros
            FROM grupos
            INNER JOIN grupo_membros ON grupos.id = grupo_membros.grupo_id
            WHERE grupo_membros.usuario_id = ?
            ORDER BY grupo_membros.entrou_em DESC`,
      args: [usuarioId],
    });
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar grupos" });
  }
});

// Lista os membros de um grupo (e devolve dados do grupo). Só para membros.
app.get("/api/grupos/:id/membros", verificarToken, async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuario.id;

  if (!idValido(id)) {
    return res.status(400).json({ erro: "Grupo inválido" });
  }
  const grupoId = Number(id);

  try {
    const grupoRes = await db.execute({
      sql: "SELECT * FROM grupos WHERE id = ?",
      args: [grupoId],
    });
    const grupo = grupoRes.rows[0];
    if (!grupo) {
      return res.status(404).json({ erro: "Grupo não encontrado" });
    }
    if (!(await ehMembroDoGrupo(grupoId, usuarioId))) {
      return res.status(403).json({ erro: "Você não faz parte desse grupo" });
    }

    const membrosRes = await db.execute({
      sql: `SELECT usuarios.id, usuarios.nome,
                   grupo_membros.entrou_em AS entrouEm
            FROM grupo_membros
            INNER JOIN usuarios ON usuarios.id = grupo_membros.usuario_id
            WHERE grupo_membros.grupo_id = ?
            ORDER BY grupo_membros.entrou_em ASC, grupo_membros.id ASC`,
      args: [grupoId],
    });

    const criadorId = Number(grupo.criador_id);
    res.json({
      id: Number(grupo.id),
      nome: grupo.nome,
      codigoConvite: grupo.codigo_convite,
      criadorId,
      membros: membrosRes.rows.map((m) => ({
        id: Number(m.id),
        nome: m.nome,
        entrouEm: m.entrouEm,
        ehCriador: Number(m.id) === criadorId,
      })),
    });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar membros do grupo" });
  }
});

// Ranking só dos membros do grupo (mesma lógica/cálculo do ranking geral,
// filtrando pelos usuários que estão em grupo_membros desse grupo).
app.get("/api/grupos/:id/ranking", verificarToken, async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuario.id;

  if (!idValido(id)) {
    return res.status(400).json({ erro: "Grupo inválido" });
  }
  const grupoId = Number(id);

  try {
    const grupoRes = await db.execute({
      sql: "SELECT 1 FROM grupos WHERE id = ?",
      args: [grupoId],
    });
    if (grupoRes.rows.length === 0) {
      return res.status(404).json({ erro: "Grupo não encontrado" });
    }
    if (!(await ehMembroDoGrupo(grupoId, usuarioId))) {
      return res.status(403).json({ erro: "Você não faz parte desse grupo" });
    }

    const resultado = await db.execute({
      sql: `SELECT usuarios.id, usuarios.nome,
                   SUM(palpites.pontos) AS totalPontos
            FROM usuarios
            INNER JOIN grupo_membros ON usuarios.id = grupo_membros.usuario_id
            LEFT JOIN palpites ON usuarios.id = palpites.usuarioId
            WHERE grupo_membros.grupo_id = ?
            GROUP BY usuarios.id
            ORDER BY totalPontos DESC`,
      args: [grupoId],
    });
    res.json(resultado.rows);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar ranking do grupo" });
  }
});

// O usuário logado sai do grupo. Se for o criador, a administração passa para
// o membro mais antigo; se não sobrar ninguém, o grupo é apagado.
app.delete("/api/grupos/:id/saida", verificarToken, async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.usuario.id;

  if (!idValido(id)) {
    return res.status(400).json({ erro: "Grupo inválido" });
  }
  const grupoId = Number(id);

  try {
    const grupoRes = await db.execute({
      sql: "SELECT * FROM grupos WHERE id = ?",
      args: [grupoId],
    });
    const grupo = grupoRes.rows[0];
    if (!grupo) {
      return res.status(404).json({ erro: "Grupo não encontrado" });
    }
    if (!(await ehMembroDoGrupo(grupoId, usuarioId))) {
      return res.status(403).json({ erro: "Você não faz parte desse grupo" });
    }

    await db.execute({
      sql: "DELETE FROM grupo_membros WHERE grupo_id = ? AND usuario_id = ?",
      args: [grupoId, usuarioId],
    });

    // Membros restantes, do mais antigo para o mais novo.
    const restantes = await db.execute({
      sql: `SELECT usuario_id FROM grupo_membros
            WHERE grupo_id = ?
            ORDER BY entrou_em ASC, id ASC`,
      args: [grupoId],
    });

    if (restantes.rows.length === 0) {
      // Último membro saiu: apaga o grupo inteiro.
      await db.execute({
        sql: "DELETE FROM grupos WHERE id = ?",
        args: [grupoId],
      });
      return res.json({
        mensagem: "Você saiu e o grupo foi removido",
        grupoRemovido: true,
      });
    }

    // Se quem saiu era o criador, transfere a administração para o mais antigo.
    if (Number(grupo.criador_id) === Number(usuarioId)) {
      const novoCriadorId = Number(restantes.rows[0].usuario_id);
      await db.execute({
        sql: "UPDATE grupos SET criador_id = ? WHERE id = ?",
        args: [novoCriadorId, grupoId],
      });
      return res.json({
        mensagem: "Você saiu. A administração foi transferida.",
        grupoRemovido: false,
        novoCriadorId,
      });
    }

    res.json({ mensagem: "Você saiu do grupo", grupoRemovido: false });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao sair do grupo" });
  }
});

// O criador remove (expulsa) um membro específico do grupo. Só o criador pode,
// e ele não pode se auto-expulsar por aqui (usa a rota de saída).
app.delete(
  "/api/grupos/:id/membros/:usuarioId",
  verificarToken,
  async (req, res) => {
    const { id, usuarioId: alvoParam } = req.params;
    const usuarioId = req.usuario.id;

    if (!idValido(id) || !idValido(alvoParam)) {
      return res.status(400).json({ erro: "Requisição inválida" });
    }
    const grupoId = Number(id);
    const alvoId = Number(alvoParam);

    try {
      const grupoRes = await db.execute({
        sql: "SELECT * FROM grupos WHERE id = ?",
        args: [grupoId],
      });
      const grupo = grupoRes.rows[0];
      if (!grupo) {
        return res.status(404).json({ erro: "Grupo não encontrado" });
      }
      if (Number(grupo.criador_id) !== Number(usuarioId)) {
        return res
          .status(403)
          .json({ erro: "Só o criador pode remover membros" });
      }
      if (alvoId === Number(usuarioId)) {
        return res
          .status(400)
          .json({ erro: "Para sair do grupo, use a opção de saída" });
      }
      if (!(await ehMembroDoGrupo(grupoId, alvoId))) {
        return res.status(404).json({ erro: "Esse membro não está no grupo" });
      }

      await db.execute({
        sql: "DELETE FROM grupo_membros WHERE grupo_id = ? AND usuario_id = ?",
        args: [grupoId, alvoId],
      });

      res.json({ mensagem: "Membro removido" });
    } catch (error) {
      res.status(500).json({ erro: "Erro ao remover membro" });
    }
  },
);

app.get("/api/perfil", verificarToken, async (req, res) => {
  const usuarioId = req.usuario.id;

  try {
    // Além dos totais já existentes, contamos:
    // - palpitesAvaliados: palpites de jogos já encerrados (pontos não-nulos),
    //   ou seja, os que já "valeram" e contam para a taxa de acerto.
    // - palpitesCorretos: dentre os avaliados, os que pontuaram positivo
    //   (acertou placar ou ao menos o resultado).
    // A "premonição" (taxa de acerto) é derivada disso no frontend, sem
    // duplicar nem alterar a lógica de pontuação existente.
    const resultado = await db.execute({
      sql: `SELECT
              COUNT(*) AS totalPalpites,
              SUM(pontos) AS totalPontos,
              SUM(CASE WHEN pontos IS NOT NULL THEN 1 ELSE 0 END) AS palpitesAvaliados,
              SUM(CASE WHEN pontos > 0 THEN 1 ELSE 0 END) AS palpitesCorretos
            FROM palpites WHERE usuarioId = ?`,
      args: [usuarioId],
    });
    const dados = resultado.rows[0];

    res.json({
      nome: req.usuario.email,
      totalPalpites: dados.totalPalpites,
      totalPontos: dados.totalPontos ?? 0,
      palpitesAvaliados: dados.palpitesAvaliados ?? 0,
      palpitesCorretos: dados.palpitesCorretos ?? 0,
    });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar perfil" });
  }
});

app.get("/api/perfil/detalhes", verificarToken, async (req, res) => {
  const usuarioId = req.usuario.id;

  try {
    const resultado = await db.execute({
      sql: "SELECT * FROM palpites WHERE usuarioId = ? ORDER BY criadoEm DESC",
      args: [usuarioId],
    });
    const palpites = resultado.rows;

    // Os nomes/escudos dos times vêm da API (via cache). Se falhar, devolvemos
    // os palpites mesmo assim, só sem os dados do jogo.
    let mapaJogos = new Map();
    try {
      const jogos = await buscarJogos();
      mapaJogos = new Map(jogos.map((jogo) => [jogo.id, jogo]));
    } catch (error) {
      console.error("Não foi possível carregar os jogos:", error.message);
    }

    const detalhes = palpites.map((palpite) => {
      const jogo = mapaJogos.get(palpite.jogoId);
      return {
        id: palpite.id,
        jogoId: palpite.jogoId,
        grupo: jogo?.grupo ?? null,
        casa: jogo?.casa ?? null,
        casaEscudo: jogo?.casaEscudo ?? null,
        fora: jogo?.fora ?? null,
        foraEscudo: jogo?.foraEscudo ?? null,
        placarCasa: palpite.placarCasa,
        placarFora: palpite.placarFora,
        placarRealCasa: jogo?.placarCasa ?? null,
        placarRealFora: jogo?.placarFora ?? null,
        pontos: palpite.pontos,
      };
    });

    res.json(detalhes);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar detalhes do perfil" });
  }
});

// Handler global de erros: captura o que escapar dos try/catch (inclusive
// JSON malformado ou corpo grande demais) e responde de forma padronizada,
// sem vazar stack trace para o cliente.
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res
      .status(400)
      .json({ erro: "JSON inválido no corpo da requisição" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ erro: "Requisição muito grande" });
  }
  console.error(err.message);
  res.status(500).json({ erro: "Erro interno do servidor" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
