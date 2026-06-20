"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useRouter, usePathname } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Link from "next/link";

interface TokenPayload {
  id: number;
  email: string;
}

const navItems = [
  { href: "/", label: "Jogos" },
  { href: "/resultados", label: "Resultados" },
  { href: "/ranking", label: "Ranking" },
  { href: "/perfil", label: "Perfil" },
];

export default function Header() {
  const [usuario, setUsuario] = useState<TokenPayload | null>(null);
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
    }
  }, []);

  function handleLogout() {
    Cookies.remove("token");
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight transition-opacity hover:opacity-80"
        >
          <span aria-hidden>⚽</span>{" "}
          <span className="bg-gradient-to-r from-green-400 via-yellow-300 to-green-400 bg-clip-text text-transparent">
            Chuta Que é Macumba
          </span>
        </Link>

        <nav className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
          {navItems.map((item) => {
            const ativo = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  ativo
                    ? "bg-green-500/15 text-green-300"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {usuario ? (
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[160px] truncate text-sm text-gray-400 sm:inline">
              {usuario.email}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-md border border-white/10 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
            >
              Sair
            </button>
          </div>
        ) : (
          <a
            href="/login"
            className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-green-500"
          >
            Entrar
          </a>
        )}
      </div>
    </header>
  );
}
