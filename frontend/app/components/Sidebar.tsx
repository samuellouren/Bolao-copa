"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import MadamePlacar from "./MadamePlacar";
import SeusPoderes from "./SeusPoderes";

// Sidebar padrão das páginas internas: Madame Placar (vidente de plantão) +
// "Seus Poderes" (progresso da rodada e estatísticas). É sticky no desktop,
// igual à coluna lateral da home. A página de Jogos NÃO usa este componente —
// lá o progresso da rodada já é calculado em tela e passado direto pro card.
//
// O anel de "rodada em andamento" precisa de quantos jogos abertos o usuário
// já cravou; como as outras páginas não carregam essa informação, a Sidebar a
// busca por conta própria (jogos públicos + palpites do usuário, se logado).
// Falha silenciosa: se algo não vier, o anel só fica em 0/0.

interface Jogo {
  id: number;
  casa: string | null;
  placarCasa: number | null;
}

interface PalpiteSalvo {
  jogoId: number;
}

export default function Sidebar({ className = "" }: { className?: string }) {
  const [cravadosNaRodada, setCravadosNaRodada] = useState(0);
  const [totalRodada, setTotalRodada] = useState(0);

  useEffect(() => {
    const token = Cookies.get("token");
    const base = process.env.NEXT_PUBLIC_API_URL;

    const reqJogos = axios.get<Jogo[]>(`${base}/api/jogos`);
    const reqPalpites = token
      ? axios
          .get<PalpiteSalvo[]>(`${base}/api/palpites`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .catch(() => null)
      : Promise.resolve(null);

    Promise.all([reqJogos, reqPalpites])
      .then(([jogosRes, palpitesRes]) => {
        // Jogos abertos = têm times definidos e ainda sem placar (mesma regra
        // da página de Jogos).
        const abertos = jogosRes.data.filter(
          (jogo) => jogo.casa && jogo.placarCasa === null,
        );
        const cravados = new Set(
          (palpitesRes?.data ?? []).map((p) => p.jogoId),
        );
        setTotalRodada(abertos.length);
        setCravadosNaRodada(abertos.filter((j) => cravados.has(j.id)).length);
      })
      .catch(() => {});
  }, []);

  return (
    <aside
      className={`flex flex-col gap-5 lg:sticky lg:top-24 ${className}`}
    >
      <MadamePlacar rotacionar />
      <SeusPoderes
        cravadosNaRodada={cravadosNaRodada}
        totalRodada={totalRodada}
      />
    </aside>
  );
}
