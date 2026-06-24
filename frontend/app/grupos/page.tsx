"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import Cookies from "js-cookie";
import Header from "../components/Header";
import MadamePlacar from "../components/MadamePlacar";

interface Grupo {
  id: number;
  nome: string;
  codigoConvite: string;
  criadorId: number;
  totalMembros: number;
}

export default function GruposPage() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [precisaLogin, setPrecisaLogin] = useState(false);

  // Formulário de criação.
  const [criando, setCriando] = useState(false);
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [salvandoCriar, setSalvandoCriar] = useState(false);
  const [erroCriar, setErroCriar] = useState("");

  // Formulário de entrada por código.
  const [codigo, setCodigo] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [erroEntrar, setErroEntrar] = useState("");

  const base = process.env.NEXT_PUBLIC_API_URL;

  function configAuth() {
    const token = Cookies.get("token");
    return { headers: { Authorization: `Bearer ${token}` } };
  }

  function carregarGrupos() {
    const token = Cookies.get("token");
    if (!token) {
      setPrecisaLogin(true);
      setCarregando(false);
      return;
    }

    axios
      .get(`${base}/api/grupos/meus`, configAuth())
      .then((res) => {
        setGrupos(res.data);
        setCarregando(false);
      })
      .catch((error) => {
        if (error?.response?.status === 401) setPrecisaLogin(true);
        setCarregando(false);
      });
  }

  useEffect(() => {
    carregarGrupos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    setErroCriar("");
    if (!nomeGrupo.trim()) {
      setErroCriar("Dá um nome pro grupo.");
      return;
    }
    setSalvandoCriar(true);
    try {
      await axios.post(
        `${base}/api/grupos`,
        { nome: nomeGrupo.trim() },
        configAuth(),
      );
      setNomeGrupo("");
      setCriando(false);
      carregarGrupos();
    } catch (error) {
      const msg =
        (axios.isAxiosError(error) && error.response?.data?.erro) ||
        "Erro ao criar grupo.";
      setErroCriar(msg);
    } finally {
      setSalvandoCriar(false);
    }
  }

  async function handleEntrar(e: React.FormEvent) {
    e.preventDefault();
    setErroEntrar("");
    if (!codigo.trim()) {
      setErroEntrar("Cola o código de convite.");
      return;
    }
    setEntrando(true);
    try {
      await axios.post(
        `${base}/api/grupos/entrar`,
        { codigo: codigo.trim() },
        configAuth(),
      );
      setCodigo("");
      carregarGrupos();
    } catch (error) {
      const msg =
        (axios.isAxiosError(error) && error.response?.data?.erro) ||
        "Erro ao entrar no grupo.";
      setErroEntrar(msg);
    } finally {
      setEntrando(false);
    }
  }

  if (carregando) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center text-muted sm:px-8">
          Carregando grupos...
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
              Entra na conta pra criar e participar de grupos.
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

  return (
    <>
      <Header />
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 text-white sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        {/* COLUNA PRINCIPAL — conteúdo */}
        <section className="min-w-0">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            <span aria-hidden>👥</span> Grupos
          </h1>
          <p className="mt-1 text-muted">
            Crave palpites e dispute o ranking só com a galera 🔮
          </p>
        </header>

        {/* Ações: criar e entrar */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          {/* Criar grupo */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            {criando ? (
              <form onSubmit={handleCriar} className="space-y-3">
                <label className="block text-sm font-medium text-lav">
                  Nome do grupo
                </label>
                <input
                  type="text"
                  value={nomeGrupo}
                  onChange={(e) => setNomeGrupo(e.target.value)}
                  maxLength={50}
                  autoFocus
                  placeholder="Ex: Resenha do trampo"
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-faint outline-none transition-colors focus:border-violet/50"
                />
                {erroCriar && (
                  <p className="text-sm text-red-300">{erroCriar}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={salvandoCriar}
                    className="rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-strong disabled:opacity-50"
                  >
                    {salvandoCriar ? "Criando..." : "Criar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCriando(false);
                      setErroCriar("");
                      setNomeGrupo("");
                    }}
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-lav transition-colors hover:bg-white/5"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h2 className="font-semibold text-white">Criar um grupo</h2>
                <p className="mt-1 text-sm text-muted">
                  Você vira o dono e convida a galera pelo código.
                </p>
                <button
                  onClick={() => setCriando(true)}
                  className="mt-4 rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-strong"
                >
                  Criar grupo
                </button>
              </>
            )}
          </div>

          {/* Entrar em grupo */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="font-semibold text-white">Entrar em um grupo</h2>
            <p className="mt-1 text-sm text-muted">
              Cola o código que um amigo te passou.
            </p>
            <form onSubmit={handleEntrar} className="mt-4 space-y-3">
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                maxLength={20}
                placeholder="Código de convite"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm uppercase tracking-widest text-white placeholder-faint outline-none transition-colors focus:border-gold/50"
              />
              {erroEntrar && (
                <p className="text-sm text-red-300">{erroEntrar}</p>
              )}
              <button
                type="submit"
                disabled={entrando}
                className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
              >
                {entrando ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </div>
        </div>

        {/* Lista de grupos */}
        <section>
          <h2 className="mb-4 text-lg font-bold tracking-tight">Meus grupos</h2>
          {grupos.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-muted">
              Você ainda não está em nenhum grupo. Cria um ou entra com um
              código! 🔮
            </div>
          ) : (
            <div className="space-y-3">
              {grupos.map((grupo) => (
                <Link
                  key={grupo.id}
                  href={`/grupos/${grupo.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-violet/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {grupo.nome}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {grupo.totalMembros}{" "}
                      {grupo.totalMembros === 1 ? "membro" : "membros"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-white/5 px-2.5 py-1 font-mono text-sm tracking-widest text-lav">
                    {grupo.codigoConvite}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
        </section>

        {/* SIDEBAR — só a Madame compacta (o ranking dos grupos já vive no
            conteúdo, então dispensa o card "Seus Poderes"). */}
        <aside className="lg:sticky lg:top-24">
          <MadamePlacar variante="compacto" rotacionar />
        </aside>
      </main>
    </>
  );
}
