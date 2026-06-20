const { createClient } = require("@libsql/client");

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function criarTabelas() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL
    )
  `);

  await db.execute(`
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
}

criarTabelas();

module.exports = db;
