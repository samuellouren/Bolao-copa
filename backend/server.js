const express = require("express");
const cors = require("cors");
require("dotenv").config();
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

app.post("/api/palpites", (req, res) => {
  const { jogoId, placarCasa, placarFora } = req.body;

  db.run(
    "INSERT INTO palpites (jogoId, placarCasa, placarFora) VALUES (?, ?, ?)",
    [jogoId, placarCasa, placarFora],
    function (err) {
      if (err) {
        return res.status(500).json({ erro: "Erro ao salvar palpite" });
      }
      res.json({ mensagem: "Palpite registrado", id: this.lastID });
    },
  );
});

app.get("/api/palpites", (req, res) => {
  db.all("SELECT * FROM palpites", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ erro: "Erro ao buscar palpites" });
    }
    res.json(rows);
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
