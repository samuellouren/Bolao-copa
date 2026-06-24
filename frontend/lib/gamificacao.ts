// Camada de gamificação PURAMENTE VISUAL sobre a pontuação real do banco.
// Nada aqui altera ou duplica o cálculo de pontos do backend (10/5/-3 com
// redistribuição). São só derivações para exibir cristais, nível e a taxa de
// acerto ("premonição") em cima dos dados que o /api/perfil já devolve.

// Dados crus que o perfil traz do backend.
export interface PerfilStats {
  totalPalpites: number;
  totalPontos: number;
  palpitesAvaliados: number; // palpites de jogos já encerrados
  palpitesCorretos: number; // dentre os avaliados, os que pontuaram > 0
}

// Cristais = a tradução mística dos pontos reais. Usamos os pontos do banco
// como base (cada ponto vira um cristal) com um piso de 0 — assim o número
// místico do header sempre bate com o "Pontos do Vidente" do perfil.
export function calcularCristais(totalPontos: number): number {
  return Math.max(0, Math.round(totalPontos));
}

// Formata o número de cristais com separador de milhar (estilo do design:
// "1.240"). Mantém em pt-BR.
export function formatarCristais(cristais: number): string {
  return cristais.toLocaleString("pt-BR");
}

// Níveis do Vidente: faixas de cristais com um título temático. Inspirado no
// "Nível 7 · Aprendiz" do design. Puramente cosmético.
const NIVEIS = [
  { minimo: 0, titulo: "Iniciante" },
  { minimo: 30, titulo: "Curioso" },
  { minimo: 80, titulo: "Aprendiz" },
  { minimo: 160, titulo: "Místico" },
  { minimo: 300, titulo: "Oráculo" },
  { minimo: 500, titulo: "Vidente Supremo" },
];

export interface Nivel {
  numero: number;
  titulo: string;
}

export function calcularNivel(cristais: number): Nivel {
  let resultado: Nivel = { numero: 1, titulo: NIVEIS[0].titulo };
  NIVEIS.forEach((faixa, indice) => {
    if (cristais >= faixa.minimo) {
      resultado = { numero: indice + 1, titulo: faixa.titulo };
    }
  });
  return resultado;
}

// Sequência de "cravadas" (palpites certeiros) mais recentes: ordena os
// palpites já avaliados por jogo (proxy cronológico) e conta, do mais novo pro
// mais antigo, quantos pontuaram (> 0) seguidos. Usada tanto no card "Seus
// Poderes" da sidebar quanto na grade de estatísticas do perfil.
export function calcularCravadasSeguidas(
  detalhes: { jogoId: number; pontos: number | null }[],
): number {
  const avaliados = detalhes
    .filter((d) => d.pontos !== null)
    .sort((a, b) => a.jogoId - b.jogoId);

  let streak = 0;
  for (let i = avaliados.length - 1; i >= 0; i--) {
    if ((avaliados[i].pontos ?? 0) > 0) streak++;
    else break;
  }
  return streak;
}

// Premonição = taxa de acerto: (corretos / avaliados) * 100, arredondada.
// Só considera palpites já avaliados (jogos encerrados). Sem avaliados ainda,
// devolve null — o frontend mostra "—" em vez de um 0% injusto.
export function calcularPremonicao(
  palpitesCorretos: number,
  palpitesAvaliados: number,
): number | null {
  if (!palpitesAvaliados || palpitesAvaliados <= 0) return null;
  return Math.round((palpitesCorretos / palpitesAvaliados) * 100);
}
