"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Header from "../components/Header";
import RankingList from "../components/RankingList";

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
        <main className="mx-auto max-w-3xl px-4 py-16 text-center text-gray-400 sm:px-8">
          Carregando ranking...
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 text-white sm:px-8 sm:py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span aria-hidden>🏆</span> Ranking
          </h1>
          <p className="mt-1 text-gray-400">Quem tem o Santo mais forte 🔮</p>
        </header>

        <RankingList ranking={ranking} />
      </main>
    </>
  );
}
