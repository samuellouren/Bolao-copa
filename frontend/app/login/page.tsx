"use client";

import { useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/login`,
        {
          email,
          senha,
        },
      );

      Cookies.set("token", response.data.token, { expires: 7 });
      router.push("/");
    } catch (error) {
      setErro("Email ou senha inválidos");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 text-white">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-violet/20 bg-white/[0.03] p-8 shadow-2xl shadow-violet-strong/20"
      >
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            <span aria-hidden>🔮</span>{" "}
            <span className="bg-gradient-to-r from-violet-light via-gold to-violet-light bg-clip-text text-transparent">
              Chute do Vidente
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            A Madame Placar te aguarda 🔮
          </p>
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          maxLength={150}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 p-2.5 outline-none transition placeholder:text-faint focus:border-violet focus:ring-2 focus:ring-violet/40"
          required
        />

        <input
          type="password"
          placeholder="Senha"
          value={senha}
          maxLength={72}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 p-2.5 outline-none transition placeholder:text-faint focus:border-violet focus:ring-2 focus:ring-violet/40"
          required
        />

        {erro && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {erro}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-violet p-2.5 font-semibold text-white transition-colors hover:bg-violet-strong"
        >
          Consultar os astros
        </button>

        <p className="text-center text-sm">
          <a
            href="/esqueci-senha"
            className="font-medium text-violet-light transition-colors hover:text-gold"
          >
            Esqueci minha senha
          </a>
        </p>

        <p className="text-center text-sm text-muted">
          Ainda não é vidente?{" "}
          <a
            href="/registro"
            className="font-medium text-violet-light transition-colors hover:text-gold"
          >
            Registre-se
          </a>
        </p>
      </form>
    </main>
  );
}
