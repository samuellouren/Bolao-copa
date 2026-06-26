"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import Cookies from "js-cookie";
import Header from "../components/Header";
import MadamePlacar from "../components/MadamePlacar";
import {
  calcularCristais,
  calcularCravadasSeguidas,
  calcularNivel,
  calcularPremonicao,
  formatarCristais,
} from "@/lib/gamificacao";

interface Perfil {
  nome: string;
  totalPalpites: number;
  totalPontos: number;
  // Campos novos do backend para a "premonição" (taxa de acerto). Opcionais
  // por segurança, caso a resposta venha de uma versão antiga da API.
  palpitesAvaliados?: number;
  palpitesCorretos?: number;
}

interface PalpiteDetalhe {
  id: number;
  jogoId: number;
  grupo: string | null;
  casa: string | null;
  casaEscudo: string | null;
  fora: string | null;
  foraEscudo: string | null;
  placarCasa: number;
  placarFora: number;
  placarRealCasa: number | null;
  placarRealFora: number | null;
  pontos: number | null;
}

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [detalhes, setDetalhes] = useState<PalpiteDetalhe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [precisaLogin, setPrecisaLogin] = useState(false);

  useEffect(() => {
    const token = Cookies.get("token");

    if (!token) {
      setPrecisaLogin(true);
      setCarregando(false);
      return;
    }

    const config = { headers: { Authorization: `Bearer ${token}` } };
    const base = process.env.NEXT_PUBLIC_API_URL;

    Promise.all([
      axios.get(`${base}/api/perfil`, config),
      axios.get(`${base}/api/perfil/detalhes`, config),
    ])
      .then(([perfilRes, detalhesRes]) => {
        setPerfil(perfilRes.data);
        setDetalhes(detalhesRes.data);
        setCarregando(false);
      })
      .catch((error) => {
        if (error?.response?.status === 401) {
          setPrecisaLogin(true);
        }
        setCarregando(false);
      });
  }, []);

  if (carregando) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center text-muted sm:px-8">
          Carregando perfil...
        </main>
      </>
    );
  }

  if (precisaLogin) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
          <div className="mx-auto max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-3xl" aria-hidden>
              🔮
            </p>
            <h1 className="mt-3 font-display text-xl font-bold text-white">
              Você precisa fazer login para continuar
            </h1>
            <p className="mt-1 text-sm text-muted">
              Entra na conta pra ver teus palpites cravados.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-lg bg-violet px-5 py-2.5 font-semibold text-white transition-colors hover:bg-violet-strong"
            >
              Fazer login
            </Link>
          </div>
        </main>
      </>
    );
  }

  if (!perfil) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center text-red-300 sm:px-8">
          Erro ao carregar perfil
        </main>
      </>
    );
  }

  // Derivações puramente visuais sobre os números reais do perfil.
  const cristais = calcularCristais(perfil.totalPontos);
  const nivel = calcularNivel(cristais);
  const premonicao = calcularPremonicao(
    perfil.palpitesCorretos ?? 0,
    perfil.palpitesAvaliados ?? 0,
  );
  // Sequência de acertos mais recente (mesmo cálculo que ficava no card "Seus
  // Poderes" da sidebar, agora exposto aqui no corpo do perfil).
  const cravadasSeguidas = calcularCravadasSeguidas(detalhes);

  return (
    <>
      <Header />
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 text-white sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        {/* COLUNA PRINCIPAL — conteúdo */}
        <section className="min-w-0">
        <header className="mb-6 flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-light to-violet-strong text-xl font-bold uppercase text-white shadow-lg shadow-violet-strong/40">
            {perfil.nome.charAt(0)}
            <span className="estrela absolute -bottom-1 left-1/2 -translate-x-1/2 text-xs text-gold">
              ✦
            </span>
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {perfil.nome}
            </h1>
            <p className="text-sm text-violet-soft">
              {nivel.titulo} · Nível {nivel.numero}
            </p>
          </div>
        </header>

        {/* Stats gamificadas (camada visual sobre os pontos reais do banco). */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-gold/25 bg-gold/[0.06] p-5 text-center">
            <p className="font-display text-3xl font-bold tabular-nums text-gold">
              <span aria-hidden className="mr-0.5 text-xl">
                ✦
              </span>
              {formatarCristais(cristais)}
            </p>
            <p className="mt-1 text-xs text-muted">Cristais</p>
          </div>
          <div className="rounded-xl border border-grass/25 bg-grass/[0.06] p-5 text-center">
            <p className="font-display text-3xl font-bold tabular-nums text-grass">
              {premonicao === null ? "—" : `${premonicao}%`}
            </p>
            <p className="mt-1 text-xs text-muted">Premonição</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center">
            <p className="font-display text-3xl font-bold tabular-nums text-violet-light">
              {perfil.totalPalpites}
            </p>
            <p className="mt-1 text-xs text-muted">Palpites cravados</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center">
            <p className="font-display text-3xl font-bold tabular-nums text-violet-light">
              {perfil.totalPontos}
            </p>
            <p className="mt-1 text-xs text-muted">Pontos do Vidente</p>
          </div>
          <div className="rounded-xl border border-violet/25 bg-violet/[0.06] p-5 text-center">
            <p className="font-display text-3xl font-bold tabular-nums text-violet-light">
              <span aria-hidden className="mr-0.5 text-xl">
                🔥
              </span>
              {cravadasSeguidas}
            </p>
            <p className="mt-1 text-xs text-muted">Cravadas seguidas</p>
          </div>
        </div>

        {/* Explicação curta da premonição (taxa de acerto real). */}
        <p className="mt-3 text-xs text-faint">
          Premonição = acertos sobre palpites já julgados
          {perfil.palpitesAvaliados
            ? ` (${perfil.palpitesCorretos ?? 0} de ${perfil.palpitesAvaliados})`
            : " — ainda sem jogos encerrados"}
          .
        </p>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold tracking-tight">
            Teus palpites
          </h2>

          {detalhes.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-muted">
              Ainda não cravou nenhum palpite. Bora pros{" "}
              <Link
                href="/"
                className="text-violet-light transition-colors hover:text-gold"
              >
                jogos
              </Link>
              ! 🔮
            </div>
          ) : (
            <div className="space-y-3">
              {detalhes.map((palpite) => (
                <div
                  key={palpite.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-violet/40 sm:p-5"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    {palpite.grupo && (
                      <span className="inline-block rounded-full bg-gold/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gold">
                        {palpite.grupo}
                      </span>
                    )}
                    {palpite.pontos !== null && (
                      <span
                        className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                          palpite.pontos > 0
                            ? "bg-grass/15 text-grass"
                            : palpite.pontos < 0
                              ? "bg-red-500/15 text-red-300"
                              : "bg-white/5 text-muted"
                        }`}
                      >
                        {palpite.pontos > 0 ? "+" : ""}
                        {palpite.pontos} pts
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 sm:gap-3">
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
                      <span className="min-w-0 text-sm font-medium text-foreground break-words sm:text-base">
                        {palpite.casa ?? "A definir"}
                      </span>
                      {palpite.casaEscudo && (
                        <Image
                          src={palpite.casaEscudo}
                          alt={palpite.casa ?? ""}
                          width={28}
                          height={28}
                          className="shrink-0"
                        />
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-center gap-1 px-2">
                      <span className="rounded-md bg-white/5 px-3 py-1 text-lg font-bold tabular-nums">
                        {palpite.placarCasa}{" "}
                        <span className="text-faint">x</span>{" "}
                        {palpite.placarFora}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-faint">
                        teu chute
                      </span>
                      {palpite.placarRealCasa !== null &&
                        palpite.placarRealFora !== null && (
                          <span className="text-[11px] tabular-nums text-muted">
                            real: {palpite.placarRealCasa} x{" "}
                            {palpite.placarRealFora}
                          </span>
                        )}
                    </div>

                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {palpite.foraEscudo && (
                        <Image
                          src={palpite.foraEscudo}
                          alt={palpite.fora ?? ""}
                          width={28}
                          height={28}
                          className="shrink-0"
                        />
                      )}
                      <span className="min-w-0 text-sm font-medium text-foreground break-words sm:text-base">
                        {palpite.fora ?? "A definir"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        </section>

        {/* SIDEBAR — só a Madame compacta (os próprios números do vidente já
            estão em destaque no corpo, então dispensa o card "Seus Poderes"). */}
        <aside className="lg:sticky lg:top-24">
          <MadamePlacar variante="compacto" rotacionar />
        </aside>
      </main>
    </>
  );
}
