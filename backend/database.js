const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./bolao.db");

db.serialize(() => {
  db.run(`
        CREATE TABLE IF NOT EXISTS palpites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jogoID INTEGER NOT NULL,
        placarCasa INTEGER NOT NULL,
        placarFora INTEGER NOT NULL,
        criadoEm TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

module.exports = db;
