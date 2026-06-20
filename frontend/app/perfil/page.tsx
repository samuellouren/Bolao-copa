"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import Header from "../components/Header";

interface Perfil {
  nome: string;
  totalPalpites: number;
  totalPontos: number;
}

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const token = Cookies.get("token");

    axios
      .get("http://localhost:3001/api/perfil", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        setPerfil(response.data);
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
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
            <p className="mt-1 text-sm text-gray-400">Pontos da macumba</p>
          </div>
        </div>
      </main>
    </>
  );
}
