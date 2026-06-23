"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";
import Header from "./components/Header";
import Cookies from "js-cookie";
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

// Palpite já salvo pelo usuário (vindo de GET /api/palpites).
interface PalpiteSalvo {
  jogoId: number;
  placarCasa: number;
  placarFora: number;
}

// Palpites fecham 5 minutos antes do horário marcado do jogo.
const ANTECEDENCIA_MINIMA_MS = 5 * 60 * 1000;

// Diz se os palpites desse jogo já encerraram (faltam menos de 5 min para o
// início, ou o jogo já começou). Mesma regra aplicada no backend.
function palpitesEncerrados(dataDoJogo: string) {
  const inicio = new Date(dataDoJogo).getTime();
  if (Number.isNaN(inicio)) return false;
  return Date.now() >= inicio - ANTECEDENCIA_MINIMA_MS;
}

// Um placar preenchido só é válido se for um número inteiro entre 0 e 20.
// String vazia não é "inválida" (apenas ainda não preenchida).
function placarInvalido(valor: string | undefined) {
  if (!valor) return false;
  return !/^\d{1,2}$/.test(valor) || Number(valor) > 20;
}

export default function Home() {
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [palpites, setPalpites] = useState<
    Record<number, { casa: string; fora: string }>
  >({});
  const [mensagens, setMensagens] = useState<Record<number, string>>({});

  // Palpites já salvos no backend, indexados por jogoId. Usados para mostrar
  // "Você já palpitou: X x Y" e travar o card até clicar em "Editar palpite".
  const [palpitesSalvos, setPalpitesSalvos] = useState<
    Record<number, { casa: number; fora: number }>
  >({});
  // Jogos cujo palpite o usuário abriu para editar (libera os inputs de novo).
  const [editando, setEditando] = useState<Record<number, boolean>>({});

  // "Relógio" que avança de minuto em minuto só para reavaliar quais jogos já
  // encerraram, sem depender de recarregar a página.
  const [, setAgora] = useState(Date.now());

  function handlePalpiteChange(
    jogoId: number,
    campo: "casa" | "fora",
    valor: string,
  ) {
    // Limita a 2 caracteres; a validação visual (placarInvalido) cuida do resto.
    setPalpites((prev) => ({
      ...prev,
      [jogoId]: { ...prev[jogoId], [campo]: valor.slice(0, 2) },
    }));
  }

  // Reabre o card para edição, pré-preenchendo os inputs com o palpite salvo.
  function editarPalpite(jogoId: number) {
    const salvo = palpitesSalvos[jogoId];
    if (salvo) {
      setPalpites((prev) => ({
        ...prev,
        [jogoId]: { casa: String(salvo.casa), fora: String(salvo.fora) },
      }));
    }
    setMensagens((prev) => ({ ...prev, [jogoId]: "" }));
    setEditando((prev) => ({ ...prev, [jogoId]: true }));
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
        `${process.env.NEXT_PUBLIC_API_URL}/api/palpites`,
        {
          jogoId,
          placarCasa: Number(palpite.casa),
          placarFora: Number(palpite.fora),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // Guarda o palpite salvo e fecha o modo de edição: o card volta a
      // mostrar "Você já palpitou: X x Y".
      setPalpitesSalvos((prev) => ({
        ...prev,
        [jogoId]: { casa: Number(palpite.casa), fora: Number(palpite.fora) },
      }));
      setEditando((prev) => ({ ...prev, [jogoId]: false }));
      setMensagens((prev) => ({ ...prev, [jogoId]: "Palpite enviado!" }));
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { erro?: string } };
      };
      let mensagem = "Erro ao enviar palpite";
      if (err.response?.status === 401) {
        mensagem = "Faça login para cravar seu palpite";
      } else if (err.response?.data?.erro) {
        // Repassa o erro do backend (ex: "Palpites encerrados para esse jogo").
        mensagem = err.response.data.erro;
      }
      setMensagens((prev) => ({ ...prev, [jogoId]: mensagem }));
    }
  }

  useEffect(() => {
    const token = Cookies.get("token");
    const base = process.env.NEXT_PUBLIC_API_URL;

    // Busca os jogos (público) e, se logado, os palpites já cravados do
    // usuário, para pré-preencher os cards.
    const reqJogos = axios.get(`${base}/api/jogos`);
    const reqPalpites = token
      ? axios.get(`${base}/api/palpites`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      : Promise.resolve(null);

    Promise.all([reqJogos, reqPalpites])
      .then(([jogosRes, palpitesRes]) => {
        setJogos(jogosRes.data);
        if (palpitesRes?.data) {
          const mapa: Record<number, { casa: number; fora: number }> = {};
          (palpitesRes.data as PalpiteSalvo[]).forEach((p) => {
            mapa[p.jogoId] = { casa: p.placarCasa, fora: p.placarFora };
          });
          setPalpitesSalvos(mapa);
        }
        setCarregando(false);
      })
      .catch((error) => {
        console.error(error);
        setCarregando(false);
      });
  }, []);

  // A cada minuto, reavalia a contagem regressiva dos jogos (fecha os que
  // chegaram a 5 min do início enquanto a página está aberta).
  useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), 60 * 1000);
    return () => clearInterval(intervalo);
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
          {jogosAbertos.map((jogo) => {
            const palpite = palpites[jogo.id];
            const erroCasa = placarInvalido(palpite?.casa);
            const erroFora = placarInvalido(palpite?.fora);
            const temErro = erroCasa || erroFora;
            const incompleto = !palpite?.casa || !palpite?.fora;

            const salvo = palpitesSalvos[jogo.id];
            const encerrado = palpitesEncerrados(jogo.data);
            // Mostra o resumo "Você já palpitou: X x Y" quando há palpite salvo
            // e o usuário não está no modo de edição.
            const mostrarResumo = !!salvo && !editando[jogo.id];

            return (
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

                  <div className="flex shrink-0 flex-col items-center gap-1.5 px-2">
                    {encerrado ? (
                      // Palpites fechados: mostra o palpite salvo (se houver) e
                      // a mensagem de encerramento. Sem inputs nem botão.
                      <>
                        {salvo && (
                          <span className="rounded-md bg-white/5 px-3 py-1 text-lg font-bold tabular-nums">
                            {salvo.casa} <span className="text-gray-500">x</span>{" "}
                            {salvo.fora}
                          </span>
                        )}
                        <p className="text-center text-[11px] text-gray-400">
                          Palpites encerrados para esse jogo
                        </p>
                      </>
                    ) : mostrarResumo ? (
                      // Já palpitou e não está editando: resumo + botão Editar.
                      <>
                        <span className="rounded-md bg-green-500/10 px-3 py-1 text-lg font-bold tabular-nums text-green-300">
                          {salvo.casa} <span className="text-gray-500">x</span>{" "}
                          {salvo.fora}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-green-400/80">
                          Você já palpitou
                        </span>
                        <button
                          onClick={() => editarPalpite(jogo.id)}
                          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:border-green-500/40 hover:text-white"
                        >
                          Editar palpite ✏️
                        </button>
                        {mensagens[jogo.id] && (
                          <p className="text-center text-[11px] text-gray-400">
                            {mensagens[jogo.id]}
                          </p>
                        )}
                      </>
                    ) : (
                      // Sem palpite ainda, ou editando: inputs + botão Cravar.
                      <>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={2}
                            aria-invalid={erroCasa}
                            value={palpite?.casa ?? ""}
                            onChange={(e) =>
                              handlePalpiteChange(
                                jogo.id,
                                "casa",
                                e.target.value,
                              )
                            }
                            className={`w-11 rounded-md border bg-white/5 p-1.5 text-center tabular-nums outline-none transition focus:ring-2 ${
                              erroCasa
                                ? "border-red-500 focus:border-red-500 focus:ring-red-500/40"
                                : "border-white/10 focus:border-green-500 focus:ring-green-500/40"
                            }`}
                          />
                          <span className="text-gray-500">x</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={2}
                            aria-invalid={erroFora}
                            value={palpite?.fora ?? ""}
                            onChange={(e) =>
                              handlePalpiteChange(
                                jogo.id,
                                "fora",
                                e.target.value,
                              )
                            }
                            className={`w-11 rounded-md border bg-white/5 p-1.5 text-center tabular-nums outline-none transition focus:ring-2 ${
                              erroFora
                                ? "border-red-500 focus:border-red-500 focus:ring-red-500/40"
                                : "border-white/10 focus:border-green-500 focus:ring-green-500/40"
                            }`}
                          />
                        </div>
                        {temErro && (
                          <p className="text-center text-[11px] text-red-400">
                            Placar deve ser entre 0 e 20
                          </p>
                        )}
                        <button
                          onClick={() => enviarPalpite(jogo.id)}
                          disabled={temErro || incompleto}
                          title={
                            incompleto
                              ? "Preencha os dois placares para cravar"
                              : undefined
                          }
                          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-green-900/40 transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:bg-green-600"
                        >
                          {salvo ? "Salvar palpite 🔮" : "Cravar 🔮"}
                        </button>
                        {incompleto && !temErro && (
                          <p className="text-center text-[11px] text-yellow-300/80">
                            Preencha os dois placares para cravar
                          </p>
                        )}
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
            );
          })}
        </div>
      </main>
    </>
  );
}
