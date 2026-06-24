"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Header from "../components/Header";
import RankingList from "../components/RankingList";
import Sidebar from "../components/Sidebar";

interface Jogador {
  id: number;
  nome: string;
  totalPontos: number | null;
}

export default function Ranking() {
  const [ranking, setRanking] = useState<Jogador[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/api/ranking`)
      .then((response) => {
        setRanking(response.data);
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center text-muted sm:px-8">
          Carregando ranking...
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 text-white sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* COLUNA PRINCIPAL — conteúdo */}
        <section className="min-w-0">
          <header className="mb-6">
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              <span aria-hidden>🏆</span> Ranking dos Videntes
            </h1>
            <p className="mt-1 text-muted">Quem acumulou mais cristais 🔮</p>
          </header>

          <RankingList ranking={ranking} />
        </section>

        {/* SIDEBAR — Madame Placar + Seus Poderes (sticky no desktop) */}
        <Sidebar />
      </main>
    </>
  );
}
