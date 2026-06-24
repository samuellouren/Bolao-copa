"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import axios from "axios";
import { useRouter, usePathname } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Link from "next/link";
import {
  calcularCristais,
  calcularNivel,
  formatarCristais,
  calcularPremonicao,
  type Nivel,
} from "@/lib/gamificacao";

interface TokenPayload {
  id: number;
  email: string;
}

// Estatísticas gamificadas exibidas no header (derivadas do /api/perfil).
interface StatsHeader {
  nome: string;
  cristais: number;
  premonicao: number | null;
  nivel: Nivel;
}

// Iniciais para o avatar do header (até 2 letras, a partir do nome do perfil).
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// O "Perfil" saiu do menu: o acesso à conta agora é o avatar de iniciais à
// direita (clicável, leva pra /perfil).
const navItems = [
  { href: "/", label: "Jogos" },
  { href: "/resultados", label: "Resultados" },
  { href: "/ranking", label: "Ranking" },
  { href: "/grupos", label: "Grupos" },
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
        const cristais = calcularCristais(d.totalPontos ?? 0);
        setStats({
          nome: d.nome ?? "",
          cristais,
          premonicao: calcularPremonicao(
            d.palpitesCorretos ?? 0,
            d.palpitesAvaliados ?? 0,
          ),
          nivel: calcularNivel(cristais),
        });
      })
      .catch(() => setStats(null));
  }, [pathname]);

  function handleLogout() {
    Cookies.remove("token");
    setStats(null);
    router.push("/login");
  }

  // Na página /perfil os mesmos números (cristais, premonição, nível) já
  // aparecem em destaque no corpo, então escondemos os chips do header ali
  // para não duplicar a informação. Nas demais páginas o header os mostra.
  const ocultarStats = pathname === "/perfil";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-base/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-lg font-bold tracking-tight transition-opacity hover:opacity-80"
        >
          <span aria-hidden>🔮</span>
          {/* "Vidente" recebe o tratamento do design: serif itálico dourado
              (font-oracle + text-gold), enquanto "Chute do" fica sans claro. */}
          <span className="font-display font-extrabold tracking-tight text-foreground">
            Chute do{" "}
            <span className="font-oracle font-medium text-gold">Vidente</span>
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
            {/* Chips de cristais e premonição (visual sobre os pontos reais).
                Ocultos em /perfil, onde os mesmos números já aparecem no corpo. */}
            {stats && !ocultarStats && (
              <div className="hidden items-center gap-2 sm:flex">
                <span
                  className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-gold"
                  title="Seus cristais (pontos do Vidente)"
                >
                  <span aria-hidden>✦</span>
                  {formatarCristais(stats.cristais)}
                  <span className="hidden font-normal text-gold/70 lg:inline">
                    cristais
                  </span>
                </span>
                <span
                  className="flex items-center gap-1 rounded-full border border-grass/30 bg-grass/10 px-2.5 py-1 text-xs font-semibold text-grass"
                  title="Premonição: sua taxa de acerto"
                >
                  <span className="hidden font-normal text-grass/70 lg:inline">
                    premonição
                  </span>
                  <span className="tabular-nums">
                    {stats.premonicao === null ? "—" : `${stats.premonicao}%`}
                  </span>
                </span>
              </div>
            )}

            {/* Avatar de iniciais + nível: acesso à conta (clica e vai pra
                /perfil). É o único "atalho de perfil" agora que o item saiu do
                menu. O nível ao lado some em /perfil pra não duplicar. */}
            <Link
              href="/perfil"
              title="Sua conta"
              aria-label="Abrir meu perfil"
              className="flex items-center gap-2 rounded-full border border-violet/30 bg-violet/10 py-1 pl-1 pr-1.5 transition-colors hover:border-violet/60 hover:bg-violet/20 sm:pr-3"
            >
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-light to-violet-strong text-[11px] font-bold uppercase text-white shadow-sm shadow-violet-strong/40"
              >
                {stats?.nome
                  ? iniciais(stats.nome)
                  : usuario.email.charAt(0).toUpperCase()}
              </span>
              {stats && !ocultarStats && (
                <span className="hidden flex-col leading-tight sm:flex">
                  <span className="text-[11px] font-semibold text-white">
                    Nível {stats.nivel.numero}
                  </span>
                  <span className="text-[10px] text-violet-soft">
                    {stats.nivel.titulo}
                  </span>
                </span>
              )}
            </Link>
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
