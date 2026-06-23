"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import Header from "../../components/Header";
import RankingList from "../../components/RankingList";

interface TokenPayload {
  id: number;
  email: string;
}

interface Membro {
  id: number;
  nome: string;
  entrouEm: string;
  ehCriador: boolean;
}

interface GrupoDetalhe {
  id: number;
  nome: string;
  codigoConvite: string;
  criadorId: number;
  membros: Membro[];
}

interface Jogador {
  id: number;
  nome: string;
  totalPontos: number | null;
}

interface Confirmacao {
  titulo: string;
  mensagem: string;
  textoBotao: string;
  onConfirm: () => void;
}

export default function GrupoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const grupoId = params.id as string;

  const [grupo, setGrupo] = useState<GrupoDetalhe | null>(null);
  const [ranking, setRanking] = useState<Jogador[]>([]);
  const [usuarioId, setUsuarioId] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [precisaLogin, setPrecisaLogin] = useState(false);
  const [erro, setErro] = useState("");

  const [copiado, setCopiado] = useState(false);
  const [acaoErro, setAcaoErro] = useState("");
  const [processando, setProcessando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);

  const base = process.env.NEXT_PUBLIC_API_URL;

  const configAuth = useCallback(() => {
    const token = Cookies.get("token");
    return { headers: { Authorization: `Bearer ${token}` } };
  }, []);

  const carregar = useCallback(() => {
    const token = Cookies.get("token");
    if (!token) {
      setPrecisaLogin(true);
      setCarregando(false);
      return;
    }

    try {
      const decoded = jwtDecode<TokenPayload>(token);
      setUsuarioId(decoded.id);
    } catch {
      setPrecisaLogin(true);
      setCarregando(false);
      return;
    }

    const config = { headers: { Authorization: `Bearer ${token}` } };

    Promise.all([
      axios.get(`${base}/api/grupos/${grupoId}/membros`, config),
      axios.get(`${base}/api/grupos/${grupoId}/ranking`, config),
    ])
      .then(([membrosRes, rankingRes]) => {
        setGrupo(membrosRes.data);
        setRanking(rankingRes.data);
        setCarregando(false);
      })
      .catch((error) => {
        const status = error?.response?.status;
        if (status === 401) {
          setPrecisaLogin(true);
        } else if (status === 403) {
          setErro("Você não faz parte desse grupo.");
        } else if (status === 404) {
          setErro("Grupo não encontrado.");
        } else {
          setErro("Erro ao carregar o grupo.");
        }
        setCarregando(false);
      });
  }, [base, grupoId, setUsuarioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function copiarCodigo() {
    if (!grupo) return;
    navigator.clipboard
      .writeText(grupo.codigoConvite)
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => {});
  }

  async function sairDoGrupo() {
    setAcaoErro("");
    setProcessando(true);
    try {
      await axios.delete(`${base}/api/grupos/${grupoId}/saida`, configAuth());
      router.push("/grupos");
    } catch (error) {
      const msg =
        (axios.isAxiosError(error) && error.response?.data?.erro) ||
        "Erro ao sair do grupo.";
      setAcaoErro(msg);
      setProcessando(false);
      setConfirmacao(null);
    }
  }

  async function removerMembro(membroId: number) {
    setAcaoErro("");
    setProcessando(true);
    try {
      await axios.delete(
        `${base}/api/grupos/${grupoId}/membros/${membroId}`,
        configAuth(),
      );
      setConfirmacao(null);
      setProcessando(false);
      carregar();
    } catch (error) {
      const msg =
        (axios.isAxiosError(error) && error.response?.data?.erro) ||
        "Erro ao remover membro.";
      setAcaoErro(msg);
      setProcessando(false);
      setConfirmacao(null);
    }
  }

  if (carregando) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center text-gray-400 sm:px-8">
          Carregando grupo...
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

  if (erro || !grupo) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-8">
          <p className="text-red-300">{erro || "Erro ao carregar o grupo."}</p>
          <Link
            href="/grupos"
            className="mt-4 inline-block text-green-400 transition-colors hover:text-green-300"
          >
            ← Voltar pros grupos
          </Link>
        </main>
      </>
    );
  }

  const souCriador = usuarioId === grupo.criadorId;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 text-white sm:px-8 sm:py-10">
        <Link
          href="/grupos"
          className="text-sm text-gray-400 transition-colors hover:text-white"
        >
          ← Grupos
        </Link>

        <header className="mt-3 mb-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span aria-hidden>👥</span> {grupo.nome}
          </h1>
        </header>

        {/* Código de convite */}
        <div className="mb-8 rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.07] p-5">
          <p className="text-sm text-gray-300">
            Código de convite — compartilhe com a galera:
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-black/40 px-4 py-2 font-mono text-2xl font-bold tracking-[0.3em] text-yellow-300">
              {grupo.codigoConvite}
            </span>
            <button
              onClick={copiarCodigo}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-white/10"
            >
              {copiado ? "✓ Copiado!" : "Copiar código"}
            </button>
          </div>
        </div>

        {acaoErro && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {acaoErro}
          </p>
        )}

        {/* Ranking do grupo */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold tracking-tight">
            <span aria-hidden>🏆</span> Ranking do grupo
          </h2>
          <RankingList ranking={ranking} />
        </section>

        {/* Membros */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold tracking-tight">
            Membros{" "}
            <span className="text-sm font-normal text-gray-500">
              ({grupo.membros.length})
            </span>
          </h2>
          <div className="space-y-2">
            {grupo.membros.map((membro) => (
              <div
                key={membro.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="font-medium">{membro.nome}</span>
                  {membro.ehCriador && (
                    <span className="shrink-0 rounded-full bg-yellow-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-300">
                      👑 Criador
                    </span>
                  )}
                  {membro.id === usuarioId && (
                    <span className="shrink-0 rounded-full bg-green-500/15 px-2.5 py-0.5 text-[11px] font-medium text-green-300">
                      você
                    </span>
                  )}
                </div>
                {souCriador && membro.id !== usuarioId && (
                  <button
                    onClick={() =>
                      setConfirmacao({
                        titulo: "Remover membro",
                        mensagem: `Tem certeza que quer remover ${membro.nome} do grupo?`,
                        textoBotao: "Remover",
                        onConfirm: () => removerMembro(membro.id),
                      })
                    }
                    className="shrink-0 rounded-md border border-white/10 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Sair do grupo */}
        <section>
          <button
            onClick={() =>
              setConfirmacao({
                titulo: "Sair do grupo",
                mensagem: souCriador
                  ? `Tem certeza que quer sair do grupo "${grupo.nome}"? Como você é o criador, a administração vai pro membro mais antigo (ou o grupo some se você for o último).`
                  : `Tem certeza que quer sair do grupo "${grupo.nome}"?`,
                textoBotao: "Sair do grupo",
                onConfirm: sairDoGrupo,
              })
            }
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20"
          >
            Sair do grupo
          </button>
        </section>
      </main>

      {/* Modal de confirmação */}
      {confirmacao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 text-white">
            <h3 className="text-lg font-bold">{confirmacao.titulo}</h3>
            <p className="mt-2 text-sm text-gray-400">{confirmacao.mensagem}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmacao(null)}
                disabled={processando}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmacao.onConfirm}
                disabled={processando}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {processando ? "Aguarde..." : confirmacao.textoBotao}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
