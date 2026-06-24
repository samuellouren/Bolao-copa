"use client";

import { useEffect, useState } from "react";

// Persona "Madame Placar": a vidente de plantão do bolão. Aparece em pontos do
// site (jogos, ranking) soltando frases místicas/temáticas. As frases são um
// array fixo por enquanto (não é dinâmico/IA). Reutilizável via <MadamePlacar />.

// Frases místicas extraídas da direção visual do design.
const FRASES_MISTICAS = [
  "Os astros sussurram um empate amargo no jogo… ou era só fome minha?",
  "Sinto uma zebra galopando pela rodada. Confie na intuição, não so no obvio.",
  "A bola de cristal embaçou no clássico. Quando embaça, chute com o coração.",
  "Vejo… vejo… um gol nos acréscimos. Anote, mas não me processe se vier de pênalti.",
  "Até vidente erra, querido. Humildade também pontua.",
  "Os cristais brilham mais forte para quem crava cedo. A pressa, hoje, é amiga.",
  "Quem está no topo do ranking que durma com um olho aberto. O mundo gira, meu bem.",
];

interface MadamePlacarProps {
  // Frase fixa. Se omitida, sorteia uma das frases místicas após montar.
  frase?: string;
  // "full": cartão completo com avatar e nome (destaque numa página).
  // "compacto": faixa enxuta para encaixar entre seções.
  variante?: "full" | "compacto";
  // Se true, troca a frase suavemente de tempos em tempos (como o design),
  // começando de um índice aleatório. Ignorado quando `frase` é fixa.
  rotacionar?: boolean;
  // Intervalo (ms) entre trocas quando `rotacionar` está ligado.
  intervaloMs?: number;
  className?: string;
}

// Avatar da Madame: orbe violeta com a estrelinha ✦ de prestígio.
// `flutua` faz a esfera levitar (sobe/desce) num loop suave.
function Orbe({ tamanho = 44 }: { tamanho?: number }) {
  return (
    <span
      aria-hidden
      className="flutua relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-light to-violet-strong text-base text-white shadow-lg shadow-violet-strong/40"
      style={{ width: tamanho, height: tamanho }}
    >
      🔮
      <span className="estrela absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-gold">
        ✦
      </span>
    </span>
  );
}

export default function MadamePlacar({
  frase,
  variante = "full",
  rotacionar = false,
  intervaloMs = 6000,
  className = "",
}: MadamePlacarProps) {
  // Índice da frase atual. Começa em null (não sorteado) para o primeiro
  // render bater com o HTML do servidor e não dar mismatch de hidratação.
  const [indice, setIndice] = useState<number | null>(null);

  useEffect(() => {
    if (frase) return;
    // Sorteia o ponto de partida só no cliente, após a hidratação.
    setIndice(Math.floor(Math.random() * FRASES_MISTICAS.length));
  }, [frase]);

  // Rotação opcional: avança a frase de tempos em tempos (como o design, que
  // cicla as falas). Só roda no cliente e quando não há frase fixa.
  useEffect(() => {
    if (frase || !rotacionar) return;
    const id = setInterval(() => {
      setIndice((atual) => ((atual ?? 0) + 1) % FRASES_MISTICAS.length);
    }, intervaloMs);
    return () => clearInterval(id);
  }, [frase, rotacionar, intervaloMs]);

  // Frase fixa vence tudo. Senão, mostra a sorteada; antes do sorteio (primeiro
  // render), cai na frase #0 como fallback estável.
  const texto = frase ?? FRASES_MISTICAS[indice ?? 0];

  if (variante === "compacto") {
    return (
      <div
        className={`flex items-start gap-3 rounded-2xl border border-violet/20 bg-violet/[0.07] px-4 py-3 ${className}`}
      >
        <Orbe tamanho={34} />
        <p className="font-oracle text-sm leading-snug text-foreground sm:text-[15px]">
          “{texto}”
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-violet/25 bg-gradient-to-br from-elevated/80 to-surface/60 p-5 ${className}`}
    >
      {/* Brilho de fundo */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-6 h-28 w-28 rounded-full bg-violet/20 blur-2xl"
      />
      <div className="relative flex items-center gap-3">
        <Orbe />
        <div>
          <p className="font-display text-lg font-bold text-white">
            Madame Placar
          </p>
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-violet-soft">
            sua vidente de plantão
          </p>
        </div>
      </div>
      <p
        key={texto}
        className="relative mt-4 font-oracle text-[15px] leading-relaxed text-foreground transition-opacity duration-500 sm:text-base"
      >
        “{texto}”
      </p>
      <p className="relative mt-2.5 text-[11px] text-muted">— Madame Placar</p>
    </div>
  );
}
