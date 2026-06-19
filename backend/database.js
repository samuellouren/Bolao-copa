const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./bolao.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS palpites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuarioId INTEGER NOT NULL,
        jogoId INTEGER NOT NULL,
        placarCasa INTEGER NOT NULL,
        placarFora INTEGER NOT NULL,
        pontos INTEGER DEFAULT NULL,
        criadoEm TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

  db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL
        )
    `);
});

module.exports = db;
