// Script de limpeza de palpites duplicados.
//
// Antes do upsert/índice único, a rota de palpites podia criar mais de um
// registro para o mesmo (usuarioId, jogoId). Este script mantém apenas o
// palpite MAIS RECENTE (maior id) de cada par e remove os demais, deixando
// o banco pronto para o índice UNIQUE de database.js.
//
// Uso: node limpar-duplicatas.js
require("dotenv").config();
const db = require("./database");

async function limparDuplicatas() {
  // Quantas duplicatas existem antes (linhas que serão removidas).
  const antes = await db.execute(`
    SELECT COUNT(*) AS total
    FROM palpites
    WHERE id NOT IN (
      SELECT MAX(id) FROM palpites GROUP BY usuarioId, jogoId
    )
  `);
  const aRemover = Number(antes.rows[0].total);

  if (aRemover === 0) {
    console.log("Nenhuma duplicata encontrada. Banco já está limpo. ✅");
    return;
  }

  console.log(`Encontradas ${aRemover} duplicata(s). Removendo...`);

  // Remove tudo que não seja o id mais alto de cada (usuarioId, jogoId).
  const resultado = await db.execute(`
    DELETE FROM palpites
    WHERE id NOT IN (
      SELECT MAX(id) FROM palpites GROUP BY usuarioId, jogoId
    )
  `);

  console.log(`Removidas ${Number(resultado.rowsAffected)} linha(s). ✅`);
  console.log("Agora reinicie o backend para criar o índice único.");
}

limparDuplicatas()
  .catch((error) => {
    console.error("Erro ao limpar duplicatas:", error.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
