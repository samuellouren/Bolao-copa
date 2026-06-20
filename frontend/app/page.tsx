"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";
import Header from "./components/Header";
import Cookies from "js-cookie";

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

export default function Home() {
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [palpites, setPalpites] = useState<
    Record<number, { casa: string; fora: string }>
  >({});
  const [mensagens, setMensagens] = useState<Record<number, string>>({});

  function handlePalpiteChange(
    jogoId: number,
    campo: "casa" | "fora",
    valor: string,
  ) {
    setPalpites((prev) => ({
      ...prev,
      [jogoId]: { ...prev[jogoId], [campo]: valor },
    }));
  }

  async function enviarPalpite(jogoId: number) {
    const palpite = palpites[jogoId];
    if (!palpite?.casa || !palpite?.fora) {
      setMensagens((prev) => ({
        ...prev,
        [jogoId]: "Preencha os dois placares",
      }));
      return;
    }

    const token = Cookies.get("token");

    if (!token) {
      setMensagens((prev) => ({
        ...prev,
        [jogoId]: "Faça login para cravar seu palpite",
      }));
      return;
    }

    try {
      await axios.post(
        "https://bolao-copa-ad7t.onrender.com/api/palpites",
        {
          jogoId,
          placarCasa: Number(palpite.casa),
          placarFora: Number(palpite.fora),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMensagens((prev) => ({ ...prev, [jogoId]: "Palpite enviado!" }));
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      setMensagens((prev) => ({
        ...prev,
        [jogoId]:
          err.response?.status === 401
            ? "Faça login para cravar seu palpite"
            : "Erro ao enviar palpite",
      }));
    }
  }

  useEffect(() => {
    axios
      .get("https://bolao-copa-ad7t.onrender.com/api/jogos")
      .then((response) => {
        setJogos(response.data);
        setCarregando(false);
      })
      .catch((error) => {
        console.error(error);
        setCarregando(false);
      });
  }, []);

  // Jogos abertos para palpite = têm times definidos e ainda sem placar.
  // Os já encerrados (com placar) ficam na página /resultados.
  const jogosAbertos = jogos.filter(
    (jogo) => jogo.casa && jogo.placarCasa === null,
  );

  if (carregando) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl px-4 py-16 text-center text-gray-400 sm:px-8">
          Carregando jogos...
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 text-white sm:px-8 sm:py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span aria-hidden>⚽</span>{" "}
            <span className="bg-gradient-to-r from-green-400 via-yellow-300 to-green-400 bg-clip-text text-transparent">
              Chute do Vidente
            </span>
          </h1>
          <p className="mt-1 text-gray-400">
            Crava o placar e veja se vc vidente de respeito 🔮 depois me fale os
            numeros da mega-sena ·{" "}
            <Link
              href="/resultados"
              className="text-green-400 transition-colors hover:text-green-300"
            >
              ver resultados
            </Link>
          </p>
        </header>

        {jogosAbertos.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-gray-400">
            Zerou os palpites, craque! Tá tudo cravado por enquanto. 🍀{" "}
            <Link
              href="/resultados"
              className="text-green-400 transition-colors hover:text-green-300"
            >
              Bora ver no que deu
            </Link>
            .
          </div>
        )}

        <div className="space-y-3">
          {jogosAbertos.map((jogo) => (
            <div
              key={jogo.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-green-500/40 sm:p-5"
            >
              {jogo.grupo && (
                <span className="mb-3 inline-block rounded-full bg-yellow-400/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-yellow-300">
                  {jogo.grupo}
                </span>
              )}

              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
                  <span className="min-w-0 text-sm font-medium break-words sm:text-base">
                    {jogo.casa}
                  </span>
                  {jogo.casaEscudo && (
                    <Image
                      src={jogo.casaEscudo}
                      alt={jogo.casa ?? ""}
                      width={28}
                      height={28}
                      className="shrink-0"
                    />
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-center gap-1.5 px-2">
                  {jogo.placarCasa !== null ? (
                    <span className="rounded-md bg-white/5 px-3 py-1 text-lg font-bold tabular-nums">
                      {jogo.placarCasa} <span className="text-gray-500">x</span>{" "}
                      {jogo.placarFora}
                    </span>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={palpites[jogo.id]?.casa ?? ""}
                          onChange={(e) =>
                            handlePalpiteChange(jogo.id, "casa", e.target.value)
                          }
                          className="w-11 rounded-md border border-white/10 bg-white/5 p-1.5 text-center tabular-nums outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/40"
                        />
                        <span className="text-gray-500">x</span>
                        <input
                          type="number"
                          min="0"
                          value={palpites[jogo.id]?.fora ?? ""}
                          onChange={(e) =>
                            handlePalpiteChange(jogo.id, "fora", e.target.value)
                          }
                          className="w-11 rounded-md border border-white/10 bg-white/5 p-1.5 text-center tabular-nums outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/40"
                        />
                      </div>
                      <button
                        onClick={() => enviarPalpite(jogo.id)}
                        className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-500"
                      >
                        Cravar 🔮
                      </button>
                      {mensagens[jogo.id] && (
                        <p className="text-center text-[11px] text-gray-400">
                          {mensagens[jogo.id]}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {jogo.foraEscudo && (
                    <Image
                      src={jogo.foraEscudo}
                      alt={jogo.fora ?? ""}
                      width={28}
                      height={28}
                      className="shrink-0"
                    />
                  )}
                  <span className="min-w-0 text-sm font-medium break-words sm:text-base">
                    {jogo.fora}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
