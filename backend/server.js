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
app.use(cors());
app.use(express.json());

// Limita tentativas de registro/login: no máximo 10 por IP a cada 15 minutos.
// Evita spam de cadastros e ataques de força bruta.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas. Tente novamente em 15 minutos." },
});

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

app.post("/api/palpites", verificarToken, async (req, res) => {
  const { jogoId, placarCasa, placarFora } = req.body;
  const usuarioId = req.usuario.id;

  if (!placarValido(placarCasa) || !placarValido(placarFora)) {
    return res.status(400).json({
      erro: "Placar inválido: use números inteiros entre 0 e 20 gols",
    });
  }

  try {
    // Verifica se o jogo já começou (já tem placar definido). Se sim,
    // ninguém pode mais palpitar/alterar. Usa o cache de jogos.
    let jogoIniciado = false;
    try {
      const jogos = await buscarJogos();
      const jogo = jogos.find((j) => j.id === Number(jogoId));
      jogoIniciado = jogo ? jogo.placarCasa !== null : false;
    } catch (error) {
      console.error("Não foi possível verificar o jogo:", error.message);
    }

    // Um palpite por jogo por usuário: se já existe, atualizamos em vez de criar.
    const existente = await db.execute({
      sql: "SELECT id FROM palpites WHERE usuarioId = ? AND jogoId = ?",
      args: [usuarioId, jogoId],
    });

    if (jogoIniciado) {
      return res
        .status(400)
        .json({ erro: "Jogo já iniciado, não é possível alterar o palpite" });
    }

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
      args: [usuarioId, jogoId, placarCasa, placarFora],
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

  try {
    const resultadoPalpite = await db.execute({
      sql: "SELECT * FROM palpites WHERE jogoId = ? AND usuarioId = ?",
      args: [jogoId, usuarioId],
    });
    const palpite = resultadoPalpite.rows[0];

    if (!palpite) {
      return res.status(404).json({ erro: "Palpite não encontrado" });
    }

    const response = await axios.get(
      `${process.env.FOOTBALL_API_URL}/matches/${jogoId}`,
      { headers: { "X-Auth-Token": process.env.FOOTBALL_API_KEY } },
    );

    const placarCasaReal = response.data.score.fullTime.home;
    const placarForaReal = response.data.score.fullTime.away;

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

app.post("/api/processar-jogo/:jogoId", async (req, res) => {
  const { jogoId } = req.params;

  try {
    const response = await axios.get(
      `${process.env.FOOTBALL_API_URL}/matches/${jogoId}`,
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
      args: [jogoId],
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
