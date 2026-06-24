"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
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
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 text-white sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* COLUNA PRINCIPAL — conteúdo */}
        <section className="min-w-0">
          <header className="mb-6">
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
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {jogosEncerrados.map((jogo) => (
                <div
                  key={jogo.id}
                  className="flex flex-col gap-3.5 rounded-2xl border border-white/10 bg-gradient-to-b from-surface-2 to-surface p-4 transition-colors hover:border-violet/40 sm:p-5"
                >
                  {/* Topo: grupo + selo "Encerrado" (mesmo padrão dos cards de Jogos) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted">
                      {jogo.grupo && (
                        <span className="truncate font-medium uppercase tracking-wide text-gold">
                          {jogo.grupo}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
                      Encerrado
                    </span>
                  </div>

                  {/* Times + placar final (sem inputs nem botões: jogo encerrado) */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-3">
                    <Time
                      nome={traduzirTime(jogo.casa)}
                      escudo={jogo.casaEscudo}
                    />

                    <div className="flex shrink-0 flex-col items-center gap-1 px-1">
                      <span className="rounded-md bg-white/5 px-3 py-1 text-lg font-bold tabular-nums">
                        {jogo.placarCasa}{" "}
                        <span className="text-muted">×</span> {jogo.placarFora}
                      </span>
                      <p className="text-center text-[11px] text-muted">
                        resultado final
                      </p>
                    </div>

                    <Time
                      nome={traduzirTime(jogo.fora)}
                      escudo={jogo.foraEscudo}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SIDEBAR — Madame Placar + Seus Poderes (sticky no desktop) */}
        <Sidebar />
      </main>
    </>
  );
}

// Coluna de um time: escudo em cima, nome embaixo, centralizado — mesmo
// componente visual dos cards da página de Jogos.
function Time({ nome, escudo }: { nome: string; escudo: string | null }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      {escudo ? (
        <Image src={escudo} alt={nome} width={40} height={40} className="shrink-0" />
      ) : (
        <span
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-faint"
        >
          ?
        </span>
      )}
      <span className="text-sm font-medium leading-tight text-foreground break-words">
        {nome}
      </span>
    </div>
  );
}
