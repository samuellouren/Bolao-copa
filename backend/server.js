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

app.get("/api/perfil", verificarToken, async (req, res) => {
  const usuarioId = req.usuario.id;

  try {
    const resultado = await db.execute({
      sql: `SELECT COUNT(*) as totalPalpites, SUM(pontos) as totalPontos
            FROM palpites WHERE usuarioId = ?`,
      args: [usuarioId],
    });
    const dados = resultado.rows[0];

    res.json({
      nome: req.usuario.email,
      totalPalpites: dados.totalPalpites,
      totalPontos: dados.totalPontos ?? 0,
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
