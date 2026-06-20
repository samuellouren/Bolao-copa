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

app.get("/api/pontuacao/:jogoId", verificarToken, async (req, res) => {
  const { jogoId } = req.params;
  const usuarioId = req.usuario.id;

  db.get(
    "SELECT * FROM palpites WHERE jogoId = ? AND usuarioId = ?",
    [jogoId, usuarioId],
    async (err, palpite) => {
      if (!palpite) {
        return res.status(404).json({ erro: "Palpite não encontrado" });
      }

      try {
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

        const resultadoPalpite = Math.sign(
          palpite.placarCasa - palpite.placarFora,
        );
        const resultadoReal = Math.sign(placarCasaReal - placarForaReal);
        const acertouResultado = resultadoPalpite === resultadoReal;

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
    },
  );
});

app.post("/api/processar-jogo/:jogoId", async (req, res) => {
  const { jogoId } = req.params;

  try {
    // busca o resultado real do jogo
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

    // busca todos os palpites desse jogo
    db.all(
      "SELECT * FROM palpites WHERE jogoId = ?",
      [jogoId],
      (err, palpites) => {
        if (err || palpites.length === 0) {
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

        // distribui os pontos perdidos entre os que acertaram
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

        // salva no banco
        atualizacoes.forEach((u) => {
          db.run("UPDATE palpites SET pontos = ? WHERE id = ?", [
            u.pontos,
            u.id,
          ]);
        });

        res.json({ mensagem: "Jogo processado!", resultados: atualizacoes });
      },
    );
  } catch (error) {
    res.status(500).json({ erro: "Erro ao processar jogo" });
  }
});

app.get("/api/ranking", (req, res) => {
  db.all(
    `SELECT usuarios.id, usuarios.nome, SUM(palpites.pontos) as totalPontos
        FROM usuarios
        LEFT JOIN palpites ON usuarios.id = palpites.usuarioId
        GROUP BY usuarios.id
        ORDER BY totalPontos DESC`,
    [],
    (err, ranking) => {
      if (err) {
        return res.status(500).json({ erro: "Erro ao buscar ranking" });
      }
      res.json(ranking);
    },
  );
});

app.get("/api/perfil", verificarToken, (req, res) => {
  const usuarioId = req.usuario.id;

  db.get(
    `SELECT COUNT(*) as totalPalpites, SUM(pontos) as totalPontos
     FROM palpites WHERE usuarioId = ?`,
    [usuarioId],
    (err, resultado) => {
      if (err) {
        return res.status(500).json({ erro: "Erro ao buscar perfil" });
      }
      res.json({
        nome: req.usuario.email,
        totalPalpites: resultado.totalPalpites,
        totalPontos: resultado.totalPontos ?? 0,
      });
    },
  );
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
