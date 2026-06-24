"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import {
  calcularPremonicao,
  calcularCravadasSeguidas,
} from "@/lib/gamificacao";

// Card "Seus Poderes" da sidebar do design: anel de progresso da rodada +
// três estatísticas (posição no bolão, cravadas seguidas, premonição %).
// TUDO derivado de dados reais já existentes no backend:
//   - posição: /api/ranking (rank do usuário logado por pontos)
//   - premonição: /api/perfil (acertos / avaliados)
//   - cravadas seguidas: /api/perfil/detalhes (sequência de acertos recentes)
// O anel "rodada em andamento" vem das props (jogos abertos x já cravados),
// calculado na própria página de Jogos. Nada aqui altera pontuação.

interface SeusPoderesProps {
  // Quantos dos jogos abertos o usuário já cravou e o total de jogos abertos.
  cravadosNaRodada: number;
  totalRodada: number;
  className?: string;
}

interface TokenPayload {
  id: number;
  email: string;
}

interface PoderesData {
  posicao: number | null; // colocação no ranking geral (1 = líder)
  premonicao: number | null; // taxa de acerto (%)
  cravadasSeguidas: number; // acertos consecutivos mais recentes
}

interface RankingRow {
  id: number;
  totalPontos: number | null;
}

interface PerfilResp {
  palpitesCorretos?: number;
  palpitesAvaliados?: number;
}

interface PalpiteDetalhe {
  jogoId: number;
  pontos: number | null;
}

export default function SeusPoderes({
  cravadosNaRodada,
  totalRodada,
  className = "",
}: SeusPoderesProps) {
  const [logado, setLogado] = useState<boolean | null>(null);
  const [dados, setDados] = useState<PoderesData | null>(null);

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) {
      setLogado(false);
      return;
    }

    let usuarioId: number;
    try {
      usuarioId = jwtDecode<TokenPayload>(token).id;
    } catch {
      setLogado(false);
      return;
    }
    setLogado(true);

    const base = process.env.NEXT_PUBLIC_API_URL;
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // Falha silenciosa por peça: se algum endpoint não responder, o card
    // simplesmente mostra "—" naquele número, sem quebrar nada.
    Promise.all([
      axios.get<RankingRow[]>(`${base}/api/ranking`),
      axios.get<PerfilResp>(`${base}/api/perfil`, auth),
      axios.get<PalpiteDetalhe[]>(`${base}/api/perfil/detalhes`, auth),
    ])
      .then(([rankingRes, perfilRes, detalhesRes]) => {
        const indice = rankingRes.data.findIndex((u) => u.id === usuarioId);
        const perfil = perfilRes.data;
        setDados({
          posicao: indice >= 0 ? indice + 1 : null,
          premonicao: calcularPremonicao(
            perfil.palpitesCorretos ?? 0,
            perfil.palpitesAvaliados ?? 0,
          ),
          cravadasSeguidas: calcularCravadasSeguidas(detalhesRes.data ?? []),
        });
      })
      .catch(() => setDados(null));
  }, []);

  // Anel de progresso da rodada (jogos abertos já cravados).
  const pct =
    totalRodada > 0 ? Math.round((cravadosNaRodada / totalRodada) * 100) : 0;
  const anel = {
    background: `conic-gradient(var(--color-grass) ${pct * 3.6}deg, rgba(255,255,255,.09) 0)`,
  };

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-b from-surface-2 to-surface p-5 ${className}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
        Seus Poderes
      </p>

      {/* Anel: progresso de palpites cravados na rodada aberta. */}
      <div className="flex items-center gap-3.5">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
          style={anel}
          aria-hidden
        >
          <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-surface text-sm font-bold tabular-nums text-white">
            {pct}%
          </span>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Rodada em andamento</p>
          <p className="text-xs text-muted tabular-nums">
            {cravadosNaRodada}/{totalRodada} cravados
          </p>
        </div>
      </div>

      <div className="h-px bg-white/[0.07]" />

      {logado === false ? (
        <p className="text-xs text-muted">
          <Link
            href="/login"
            className="font-semibold text-violet-light transition-colors hover:text-gold"
          >
            Entre na conta
          </Link>{" "}
          pra ver sua posição, sequência e premonição.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Estatistica
            valor={dados?.posicao ? `${dados.posicao}º` : "—"}
            rotulo="no bolão"
            cor="text-white"
          />
          <Estatistica
            valor={dados ? String(dados.cravadasSeguidas) : "—"}
            rotulo="cravadas seguidas"
            cor="text-grass"
          />
          <Estatistica
            valor={
              dados?.premonicao === null || dados === null
                ? "—"
                : `${dados.premonicao}%`
            }
            rotulo="premonição"
            cor="text-gold"
          />
        </div>
      )}
    </div>
  );
}

function Estatistica({
  valor,
  rotulo,
  cor,
}: {
  valor: string;
  rotulo: string;
  cor: string;
}) {
  return (
    <div className="min-w-0">
      <p className={`font-display text-lg font-bold tabular-nums ${cor}`}>
        {valor}
      </p>
      <p className="mt-0.5 text-[10px] leading-tight text-muted">{rotulo}</p>
    </div>
  );
}
