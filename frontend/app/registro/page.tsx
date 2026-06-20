"use client";

import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function Registro() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const router = useRouter();

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    try {
      await axios.post("http://localhost:3001/api/registro", {
        nome,
        email,
        senha,
      });

      setSucesso(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { erro?: string } } };
      setErro(err.response?.data?.erro || "Erro ao criar conta");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 text-white">
      <form
        onSubmit={handleRegistro}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-green-900/20"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            <span aria-hidden>⚽</span>{" "}
            <span className="bg-gradient-to-r from-green-400 via-yellow-300 to-green-400 bg-clip-text text-transparent">
              Chuta Que é Macumba
            </span>
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Faz tua conta e firma o santo 🔮
          </p>
        </div>

        <input
          type="text"
          placeholder="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 p-2.5 outline-none transition placeholder:text-gray-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/40"
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 p-2.5 outline-none transition placeholder:text-gray-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/40"
          required
        />

        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 p-2.5 outline-none transition placeholder:text-gray-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/40"
          required
        />

        {erro && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {erro}
          </p>
        )}
        {sucesso && (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            Conta criada! Redirecionando...
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-green-600 p-2.5 font-semibold text-white transition-colors hover:bg-green-500"
        >
          Tô dentro
        </button>

        <p className="text-center text-sm text-gray-400">
          Já é da macumba?{" "}
          <a
            href="/login"
            className="font-medium text-green-400 transition-colors hover:text-green-300"
          >
            Entrar
          </a>
        </p>
      </form>
    </main>
  );
}
