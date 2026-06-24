"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import axios from "axios";
import { useRouter, usePathname } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Link from "next/link";
import {
  calcularCristais,
  formatarCristais,
  calcularPremonicao,
} from "@/lib/gamificacao";

interface TokenPayload {
  id: number;
  email: string;
}

// Estatísticas gamificadas exibidas no header (derivadas do /api/perfil).
interface StatsHeader {
  cristais: number;
  premonicao: number | null;
}

const navItems = [
  { href: "/", label: "Jogos" },
  { href: "/resultados", label: "Resultados" },
  { href: "/ranking", label: "Ranking" },
  { href: "/grupos", label: "Grupos" },
  { href: "/perfil", label: "Perfil" },
];

export default function Header() {
  const [usuario, setUsuario] = useState<TokenPayload | null>(null);
  const [stats, setStats] = useState<StatsHeader | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) {
      setUsuario(null);
      return;
    }

    try {
      const decoded = jwtDecode<TokenPayload>(token);
      setUsuario(decoded);
    } catch {
      setUsuario(null);
      return;
    }

    // Busca os dados do perfil só para alimentar os cristais/premonição do
    // header. Falha silenciosa: se não vier, o header simplesmente não mostra
    // os números místicos (nenhuma feature quebra).
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/api/perfil`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const d = res.data;
        setStats({
          cristais: calcularCristais(d.totalPontos ?? 0),
          premonicao: calcularPremonicao(
            d.palpitesCorretos ?? 0,
            d.palpitesAvaliados ?? 0,
          ),
        });
      })
      .catch(() => setStats(null));
  }, [pathname]);

  function handleLogout() {
    Cookies.remove("token");
    setStats(null);
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-base/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-lg font-bold tracking-tight transition-opacity hover:opacity-80"
        >
          <span aria-hidden>🔮</span>
          <span className="font-display bg-gradient-to-r from-violet-light via-gold to-violet-light bg-clip-text text-transparent">
            Chute do Vidente
          </span>
        </Link>

        <nav className="scrollbar-hide order-3 -mx-4 flex w-screen gap-1 overflow-x-auto px-4 sm:order-none sm:mx-0 sm:w-auto sm:px-0">
          {navItems.map((item) => {
            const ativo = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:py-1.5 ${
                  ativo
                    ? "bg-violet/20 text-violet-light"
                    : "text-muted hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {usuario ? (
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Cristais e premonição (gamificação visual sobre os pontos reais) */}
            {stats && (
              <div className="hidden items-center gap-2 sm:flex">
                <span
                  className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-gold"
                  title="Seus cristais (pontos do Vidente)"
                >
                  <span aria-hidden>✦</span>
                  {formatarCristais(stats.cristais)}
                </span>
                <span
                  className="flex items-center gap-1 rounded-full border border-grass/30 bg-grass/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-grass"
                  title="Premonição: sua taxa de acerto"
                >
                  {stats.premonicao === null ? "—" : `${stats.premonicao}%`}
                </span>
              </div>
            )}
            <span className="hidden max-w-[140px] truncate text-sm text-muted lg:inline">
              {usuario.email}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-md border border-white/10 px-3 py-1.5 text-sm font-medium text-lav transition-colors hover:border-magenta/40 hover:bg-magenta/10 hover:text-magenta-soft"
            >
              Sair
            </button>
          </div>
        ) : (
          <a
            href="/login"
            className="rounded-md bg-violet px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-violet-strong"
          >
            Entrar
          </a>
        )}
      </div>
    </header>
  );
}
