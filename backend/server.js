const express = require("express");
const cors = require("cors");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const validator = require("validator");
const { criarToken, verificarToken } = require("./auth");
const axios = require("axios");
const db = require("./database");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ mensagem: "Bolao copa API func" });
});

app.get("/api/jogos", async (req, res) => {
  try {
    const response = await axios.get(
      `${process.env.FOOTBALL_API_URL}/competitions/WC/matches`,
      {
        headers: { "X-auth-Token": process.env.FOOTBALL_API_KEY },
      },
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
    res.json(jogos);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ erro: "Erro ao buscar jogos" });
  }
});

app.post("/api/palpites", verificarToken, (req, res) => {
  const { jogoId, placarCasa, placarFora } = req.body;
  const usuarioId = req.usuario.id;

  db.run(
    "INSERT INTO palpites (usuarioId, jogoId, placarCasa, placarFora) VALUES (?, ?, ?, ?)",
    [usuarioId, jogoId, placarCasa, placarFora],
    function (err) {
      if (err) {
        return res.status(500).json({ erro: "Erro ao salvar palpite" });
      }
      res.json({ mensagem: "Palpite registrado", id: this.lastID });
    },
  );
});

app.get("/api/palpites", verificarToken, (req, res) => {
  const usuarioId = req.usuario.id;

  db.all(
    "SELECT * FROM palpites WHERE usuarioId = ?",
    [usuarioId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ erro: "Erro ao buscar palpites" });
      }
      res.json(rows);
    },
  );
});

app.post("/api/registro", async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!validator.isEmail(email)) {
    return res.status(400).json({ erro: "Email invalido" });
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  db.run(
    "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)",
    [nome, email, senhaHash],
    function (err) {
      if (err) {
        return res.status(400).json({ erro: "Email ja cadastrado" });
      }
      res.json({ mensagem: "Usuario criado!", id: this.lastID });
    },
  );
});

app.post("/api/login", (req, res) => {
  const { email, senha } = req.body;
  db.get(
    "SELECT * FROM usuarios WHERE email = ?",
    [email],
    async (err, usuario) => {
      if (!usuario) {
        return res.status(401).json({ erro: "Email ou Senha invalidos" });
      }

      const senhaValida = await bcrypt.compare(senha, usuario.senha);
      if (!senhaValida) {
        return res.status(401).json({ erro: "Email ou Senha invalidos" });
      }

      const token = criarToken(usuario);
      res.json({ mensagem: "Login realizado!", token });
    },
  );
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
