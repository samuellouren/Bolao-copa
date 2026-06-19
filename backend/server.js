const express = require("express");
const cors = require("cors");
require("dotenv").config();
const axios = require("axios");

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
