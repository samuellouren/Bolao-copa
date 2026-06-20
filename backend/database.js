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

  // Garante no banco que existe no máximo 1 palpite por usuário por jogo.
  // Protege contra duplicatas em requisições simultâneas (o upsert da
  // aplicação não é atômico). Se já houver duplicatas antigas, a criação
  // do índice falha; nesse caso limpe os registros repetidos e rode de novo.
  try {
    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_palpites_usuario_jogo
      ON palpites (usuarioId, jogoId)
    `);
  } catch (error) {
    console.error(
      "Não foi possível criar índice único em palpites (há duplicatas?):",
      error.message,
    );
  }
}

criarTabelas();

module.exports = db;
