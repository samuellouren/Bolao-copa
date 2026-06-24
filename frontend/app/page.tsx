"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";
import Header from "./components/Header";
import MadamePlacar from "./components/MadamePlacar";
import SeusPoderes from "./components/SeusPoderes";
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

// Placar mais cravado pela galera por jogo (GET /api/palpites/populares).
interface Popular {
  jogoId: number;
  placarCasa: number;
  placarFora: number;
  total: number;
}

// Níveis de "energia mística": rótulo PURAMENTE visual da confiança do palpite.
// NÃO altera pontuação nem é enviado ao backend — é só um selo lúdico no card.
const ENERGIAS = ["Palpite", "Intuição", "Premonição"] as const;

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

const pad = (n: number) => String(n).padStart(2, "0");

// Formata o horário do jogo como "Hoje 13:00" / "Amanhã 16:00" / "23/06 19:00".
function formatarHorario(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const hoje = new Date();
  const amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);
  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  let dia: string;
  if (mesmoDia(d, hoje)) dia = "Hoje";
  else if (mesmoDia(d, amanha)) dia = "Amanhã";
  else dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${dia} ${hora}`;
}

// Formata um intervalo (em ms) como HH:MM:SS. Devolve null se já passou.
function formatarContagem(ms: number) {
  if (ms <= 0) return null;
  const totalSeg = Math.floor(ms / 1000);
  return `${pad(Math.floor(totalSeg / 3600))}:${pad(
    Math.floor((totalSeg % 3600) / 60),
  )}:${pad(totalSeg % 60)}`;
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

  // Placar mais cravado pela galera, por jogoId (camada visual "a galera crava").
  const [populares, setPopulares] = useState<
    Record<number, { casa: number; fora: number; total: number }>
  >({});

  // "Energia mística" escolhida por jogo (1=Palpite, 2=Intuição, 3=Premonição).
  // Estado puramente visual: não vai pro backend nem mexe na pontuação.
  const [energia, setEnergia] = useState<Record<number, number>>({});

  // "Relógio" que avança de segundo em segundo para a contagem regressiva e
  // para reavaliar quais jogos já encerraram, sem recarregar a página.
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

    // Busca os jogos e o placar popular (públicos) e, se logado, os palpites
    // já cravados do usuário, para pré-preencher os cards.
    const reqJogos = axios.get(`${base}/api/jogos`);
    const reqPopulares = axios
      .get(`${base}/api/palpites/populares`)
      .catch(() => null);
    const reqPalpites = token
      ? axios.get(`${base}/api/palpites`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      : Promise.resolve(null);

    Promise.all([reqJogos, reqPalpites, reqPopulares])
      .then(([jogosRes, palpitesRes, popularesRes]) => {
        setJogos(jogosRes.data);
        if (palpitesRes?.data) {
          const mapa: Record<number, { casa: number; fora: number }> = {};
          (palpitesRes.data as PalpiteSalvo[]).forEach((p) => {
            mapa[p.jogoId] = { casa: p.placarCasa, fora: p.placarFora };
          });
          setPalpitesSalvos(mapa);
        }
        if (popularesRes?.data) {
          const mapa: Record<number, { casa: number; fora: number; total: number }> =
            {};
          (popularesRes.data as Popular[]).forEach((p) => {
            mapa[p.jogoId] = {
              casa: p.placarCasa,
              fora: p.placarFora,
              total: p.total,
            };
          });
          setPopulares(mapa);
        }
        setCarregando(false);
      })
      .catch((error) => {
        console.error(error);
        setCarregando(false);
      });
  }, []);

  // A cada segundo, reavalia a contagem regressiva e fecha os jogos que
  // chegaram a 5 min do início enquanto a página está aberta.
  useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  // Jogos abertos para palpite = têm times definidos e ainda sem placar.
  // Os já encerrados (com placar) ficam na página /resultados.
  const jogosAbertos = jogos.filter(
    (jogo) => jogo.casa && jogo.placarCasa === null,
  );

  // Progresso da rodada e contagem para o fechamento do próximo portal.
  const cravadosNaRodada = jogosAbertos.filter(
    (jogo) => palpitesSalvos[jogo.id],
  ).length;
  // Próximo jogo cujo portal ainda não fechou (faltam > 5 min pro início).
  // Conforme o tempo passa, o jogo do topo fecha e este cálculo escorrega
  // automaticamente para o próximo da fila, junto com o nome dos times.
  const proximoJogo = jogosAbertos
    .filter((jogo) => {
      const fecha = new Date(jogo.data).getTime() - ANTECEDENCIA_MINIMA_MS;
      return Number.isFinite(fecha) && fecha > Date.now();
    })
    .sort(
      (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime(),
    )[0];
  const contagem = proximoJogo
    ? formatarContagem(
        new Date(proximoJogo.data).getTime() -
          ANTECEDENCIA_MINIMA_MS -
          Date.now(),
      )
    : null;

  if (carregando) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-16 text-center text-muted sm:px-8">
          Carregando jogos...
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
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                <span aria-hidden>🔮</span>{" "}
                <span className="bg-gradient-to-r from-violet-light via-gold to-violet-light bg-clip-text text-transparent">
                  Chute do Vidente
                </span>
              </h1>
              <p className="mt-1 text-muted">
                {jogosAbertos.length > 0
                  ? `${jogosAbertos.length} ${
                      jogosAbertos.length === 1 ? "jogo" : "jogos"
                    } para cravar`
                  : "Tudo cravado por enquanto"}{" "}
                ·{" "}
                <Link
                  href="/resultados"
                  className="text-violet-light transition-colors hover:text-gold"
                >
                  ver resultados
                </Link>
              </p>
            </div>

            {/* Contador do próximo portal a fechar, nomeando o jogo específico.
                Ao fechar, escorrega sozinho para o próximo jogo da fila. */}
            {contagem && proximoJogo && (
              <div className="flex items-center gap-2.5 rounded-xl border border-magenta/30 bg-magenta/[0.08] px-4 py-2.5">
                <span className="text-[11px] uppercase tracking-wide text-magenta-soft">
                  Portal de {traduzirTime(proximoJogo.casa)} ×{" "}
                  {traduzirTime(proximoJogo.fora)} fecha em
                </span>
                <span className="font-display text-lg font-bold tabular-nums tracking-wide text-magenta">
                  {contagem}
                </span>
              </div>
            )}
          </header>

          {jogosAbertos.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-muted">
              Zerou os palpites, craque! Tá tudo cravado por enquanto. 🍀{" "}
              <Link
                href="/resultados"
                className="text-violet-light transition-colors hover:text-gold"
              >
                Bora ver no que deu
              </Link>
              .
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {jogosAbertos.map((jogo) => {
              const palpite = palpites[jogo.id];
              const erroCasa = placarInvalido(palpite?.casa);
              const erroFora = placarInvalido(palpite?.fora);
              const temErro = erroCasa || erroFora;
              const incompleto = !palpite?.casa || !palpite?.fora;

              const salvo = palpitesSalvos[jogo.id];
              const encerrado = palpitesEncerrados(jogo.data);
              // Mostra o resumo "Você já palpitou: X x Y" quando há palpite
              // salvo e o usuário não está no modo de edição.
              const mostrarResumo = !!salvo && !editando[jogo.id];
              const popular = populares[jogo.id];

              // Selo de status do card (visual): encerrado / já palpitou / sem.
              const status = encerrado
                ? { texto: "Encerrado", classe: "border-white/10 bg-white/5 text-faint" }
                : mostrarResumo
                  ? {
                      texto: "Você palpitou",
                      classe: "border-grass/40 bg-grass/10 text-grass",
                    }
                  : {
                      texto: "Sem palpite",
                      classe: "border-white/10 bg-white/[0.03] text-muted",
                    };

              return (
                <div
                  key={jogo.id}
                  className={`flex flex-col gap-3.5 rounded-2xl border bg-gradient-to-b from-surface-2 to-surface p-4 transition-colors sm:p-5 ${
                    mostrarResumo
                      ? "border-grass/30"
                      : "border-white/10 hover:border-violet/40"
                  }`}
                >
                  {/* Topo: grupo · horário + selo de status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted">
                      {jogo.grupo && (
                        <span className="truncate font-medium uppercase tracking-wide text-gold">
                          {jogo.grupo}
                        </span>
                      )}
                      {jogo.grupo && (
                        <span
                          aria-hidden
                          className="h-1 w-1 shrink-0 rounded-full bg-faint"
                        />
                      )}
                      <span className="shrink-0">{formatarHorario(jogo.data)}</span>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${status.classe}`}
                    >
                      {status.texto}
                    </span>
                  </div>

                  {/* Times + área de palpite (casa | centro | fora) */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-3">
                    <Time
                      nome={traduzirTime(jogo.casa)}
                      escudo={jogo.casaEscudo}
                    />

                    <div className="flex shrink-0 flex-col items-center gap-1.5 px-1">
                      {encerrado ? (
                        // Palpites fechados: mostra o palpite salvo (se houver)
                        // e a mensagem de encerramento. Sem inputs nem botão.
                        <>
                          {salvo && (
                            <span className="rounded-md bg-white/5 px-3 py-1 text-lg font-bold tabular-nums">
                              {salvo.casa}{" "}
                              <span className="text-muted">×</span> {salvo.fora}
                            </span>
                          )}
                          <p className="text-center text-[11px] text-muted">
                            Palpites encerrados
                          </p>
                        </>
                      ) : mostrarResumo ? (
                        // Já palpitou e não está editando: resumo + botão Editar.
                        <>
                          <span className="rounded-md bg-grass/10 px-3 py-1 text-lg font-bold tabular-nums text-grass">
                            {salvo.casa}{" "}
                            <span className="text-grass/60">×</span> {salvo.fora}
                          </span>
                          <button
                            onClick={() => editarPalpite(jogo.id)}
                            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-lav transition-colors hover:border-violet/40 hover:text-white"
                          >
                            Editar ✏️
                          </button>
                          {mensagens[jogo.id] && (
                            <p className="text-center text-[11px] text-muted">
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
                                  : "border-white/10 focus:border-violet focus:ring-violet/40"
                              }`}
                            />
                            <span className="text-muted">×</span>
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
                                  : "border-white/10 focus:border-violet focus:ring-violet/40"
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
                            className="rounded-md bg-grass px-3 py-1.5 text-xs font-semibold text-base shadow-sm shadow-grass/20 transition-colors hover:bg-grass/90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:bg-grass"
                          >
                            {salvo ? "Salvar 🔮" : "Cravar 🔮"}
                          </button>
                          {incompleto && !temErro && (
                            <p className="text-center text-[11px] text-gold/80">
                              Preencha os dois placares
                            </p>
                          )}
                          {mensagens[jogo.id] && (
                            <p className="text-center text-[11px] text-muted">
                              {mensagens[jogo.id]}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <Time
                      nome={traduzirTime(jogo.fora)}
                      escudo={jogo.foraEscudo}
                    />
                  </div>

                  {/* A galera crava: placar mais comum entre os usuários */}
                  {popular && (
                    <div className="flex items-center justify-center gap-2 text-[11.5px] text-muted">
                      <span>a galera crava</span>
                      <span className="rounded-full bg-white/5 px-2.5 py-0.5 font-semibold text-lav tabular-nums">
                        {popular.casa} × {popular.fora}
                      </span>
                    </div>
                  )}

                  <div className="h-px bg-white/[0.07]" />

                  {/* Energia mística: selo de confiança (visual, sem pontuação) */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="shrink-0 text-[11px] text-muted"
                      title="Só por diversão — não altera a pontuação."
                    >
                      energia mística
                    </span>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {ENERGIAS.map((rotulo, i) => {
                        const nivel = i + 1;
                        const ativo = energia[jogo.id] === nivel;
                        return (
                          <button
                            key={rotulo}
                            type="button"
                            onClick={() =>
                              setEnergia((prev) => ({
                                ...prev,
                                [jogo.id]: prev[jogo.id] === nivel ? 0 : nivel,
                              }))
                            }
                            aria-pressed={ativo}
                            className={`rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${
                              ativo
                                ? "border-gold bg-gold/15 text-gold"
                                : "border-white/10 bg-white/[0.03] text-muted hover:border-gold/40 hover:text-lav"
                            }`}
                          >
                            {rotulo}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SIDEBAR — Madame Placar + Seus Poderes (sticky no desktop) */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
          <MadamePlacar rotacionar />
          <SeusPoderes
            cravadosNaRodada={cravadosNaRodada}
            totalRodada={jogosAbertos.length}
          />
        </aside>
      </main>
    </>
  );
}

// Coluna de um time: escudo em cima, nome embaixo, centralizado (como o design).
// Nome em text-foreground (branco-lavanda) para bom contraste, não cinza.
function Time({
  nome,
  escudo,
}: {
  nome: string;
  escudo: string | null;
}) {
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
