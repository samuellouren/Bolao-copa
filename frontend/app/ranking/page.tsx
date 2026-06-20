"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Header from "../components/Header";

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
      .get("http://localhost:3001/api/ranking")
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

  const medalhas = ["🥇", "🥈", "🥉"];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 text-white sm:px-8 sm:py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span aria-hidden>🏆</span> Ranking
          </h1>
          <p className="mt-1 text-gray-400">
            Quem tem o santo mais forte 🔮
          </p>
        </header>

        <div className="space-y-2">
          {ranking.map((jogador, index) => {
            const podio = index < 3;
            return (
              <div
                key={jogador.id}
                className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
                  podio
                    ? "border-yellow-400/30 bg-yellow-400/[0.07]"
                    : "border-white/10 bg-white/[0.03] hover:border-green-500/30"
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="w-7 text-center text-lg font-semibold tabular-nums text-gray-400">
                    {podio ? medalhas[index] : index + 1}
                  </span>
                  <span className="font-medium">{jogador.nome}</span>
                </div>
                <span className="font-bold tabular-nums text-yellow-300">
                  {jogador.totalPontos ?? 0}{" "}
                  <span className="text-sm font-normal text-gray-500">pts</span>
                </span>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
