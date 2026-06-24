"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";
import Header from "../components/Header";
import { traduzirTime } from "@/lib/times";

interface Jogo {
  id: number;
  data: string;
  grupo: string | null;
  casa: string | null;
  casaEscudo: string | null;
  fora: string | null;
  foraEscudo: string | null;
  placarCasa: number | null;
  placarFora: number | null;
}

export default function Resultados() {
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/api/jogos`)
      .then((response) => {
        setJogos(response.data);
        setCarregando(false);
      })
      .catch((error) => {
        console.error(error);
        setCarregando(false);
      });
  }, []);

  if (carregando) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-16 text-center text-muted sm:px-8">
          Carregando resultados...
        </main>
      </>
    );
  }

  // Jogos já encerrados = com placar definido.
  const jogosEncerrados = jogos.filter((jogo) => jogo.placarCasa !== null);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 text-white sm:px-8 sm:py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            <span aria-hidden>📜</span> Resultados
          </h1>
          <p className="mt-1 text-muted">
            A premonição pegou ou deu zebra? 🐴 ·{" "}
            <Link
              href="/"
              className="text-violet-light transition-colors hover:text-gold"
            >
              voltar aos palpites
            </Link>
          </p>
        </header>

        {jogosEncerrados.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-muted">
            Ainda não rolou nenhum jogo. Segura a ansiedade, Vidente! 🔮
          </div>
        ) : (
          <div className="space-y-3">
            {jogosEncerrados.map((jogo) => (
              <div
                key={jogo.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-violet/40 sm:p-5"
              >
                {jogo.grupo && (
                  <span className="mb-3 inline-block rounded-full bg-gold/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gold">
                    {jogo.grupo}
                  </span>
                )}

                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
                    <span className="min-w-0 text-sm font-medium break-words sm:text-base">
                      {traduzirTime(jogo.casa)}
                    </span>
                    {jogo.casaEscudo && (
                      <Image
                        src={jogo.casaEscudo}
                        alt={traduzirTime(jogo.casa)}
                        width={28}
                        height={28}
                        className="shrink-0"
                      />
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-center px-2">
                    <span className="rounded-md bg-white/5 px-3 py-1 text-lg font-bold tabular-nums">
                      {jogo.placarCasa} <span className="text-faint">x</span>{" "}
                      {jogo.placarFora}
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {jogo.foraEscudo && (
                      <Image
                        src={jogo.foraEscudo}
                        alt={traduzirTime(jogo.fora)}
                        width={28}
                        height={28}
                        className="shrink-0"
                      />
                    )}
                    <span className="min-w-0 text-sm font-medium break-words sm:text-base">
                      {traduzirTime(jogo.fora)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
