const Database = require("better-sqlite3");

const db = new Database("./bolao.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL
  )
`);

db.exec(`
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

module.exports = db;
