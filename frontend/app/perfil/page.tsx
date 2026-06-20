"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import Cookies from "js-cookie";
import Header from "../components/Header";

interface Perfil {
  nome: string;
  totalPalpites: number;
  totalPontos: number;
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
    const base = "https://bolao-copa-ad7t.onrender.com";

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
        <main className="mx-auto max-w-3xl px-4 py-16 text-center text-gray-400 sm:px-8">
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
            <h1 className="mt-3 text-xl font-bold text-white">
              Você precisa fazer login para continuar
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Entra na conta pra ver teus palpites cravados.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-lg bg-green-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-green-500"
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

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 text-white sm:px-8 sm:py-10">
        <header className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-yellow-400 text-xl font-bold uppercase text-black">
            {perfil.nome.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {perfil.nome}
            </h1>
            <p className="text-sm text-gray-400">Macumbeiro de palpite 🔮</p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-4xl font-bold tabular-nums text-green-300">
              {perfil.totalPalpites}
            </p>
            <p className="mt-1 text-sm text-gray-400">Palpites cravados</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-4xl font-bold tabular-nums text-yellow-300">
              {perfil.totalPontos}
            </p>
            <p className="mt-1 text-sm text-gray-400">Pontos do Vidente</p>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold tracking-tight">
            Teus palpites
          </h2>

          {detalhes.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-gray-400">
              Ainda não cravou nenhum palpite. Bora pros{" "}
              <Link
                href="/"
                className="text-green-400 transition-colors hover:text-green-300"
              >
                jogos
              </Link>
              ! 🍀
            </div>
          ) : (
            <div className="space-y-3">
              {detalhes.map((palpite) => (
                <div
                  key={palpite.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-green-500/40 sm:p-5"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    {palpite.grupo && (
                      <span className="inline-block rounded-full bg-yellow-400/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-yellow-300">
                        {palpite.grupo}
                      </span>
                    )}
                    {palpite.pontos !== null && (
                      <span
                        className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                          palpite.pontos > 0
                            ? "bg-green-500/15 text-green-300"
                            : palpite.pontos < 0
                              ? "bg-red-500/15 text-red-300"
                              : "bg-white/5 text-gray-400"
                        }`}
                      >
                        {palpite.pontos > 0 ? "+" : ""}
                        {palpite.pontos} pts
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 sm:gap-3">
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
                      <span className="min-w-0 text-sm font-medium break-words sm:text-base">
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
                        <span className="text-gray-500">x</span>{" "}
                        {palpite.placarFora}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-500">
                        teu chute
                      </span>
                      {palpite.placarRealCasa !== null &&
                        palpite.placarRealFora !== null && (
                          <span className="text-[11px] tabular-nums text-gray-400">
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
                      <span className="min-w-0 text-sm font-medium break-words sm:text-base">
                        {palpite.fora ?? "A definir"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
