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

  // Grupos privados de palpites. Cada grupo tem um código de convite curto e
  // único (compartilhado entre amigos) e um criador (que administra o grupo).
  await db.execute(`
    CREATE TABLE IF NOT EXISTS grupos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      codigo_convite TEXT NOT NULL UNIQUE,
      criador_id INTEGER NOT NULL,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Relação N:N entre grupos e usuários (quem participa de cada grupo).
  await db.execute(`
    CREATE TABLE IF NOT EXISTS grupo_membros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grupo_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      entrou_em TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Garante no banco que um usuário entra no máximo uma vez por grupo,
  // protegendo contra requisições simultâneas que dupliquem a participação.
  try {
    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_grupo_membros_grupo_usuario
      ON grupo_membros (grupo_id, usuario_id)
    `);
  } catch (error) {
    console.error(
      "Não foi possível criar índice único em grupo_membros (há duplicatas?):",
      error.message,
    );
  }
}

criarTabelas();

module.exports = db;
