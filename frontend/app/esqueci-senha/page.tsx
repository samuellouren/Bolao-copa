"use client";

import { useState } from "react";
import axios from "axios";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);

    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/recuperar-senha`, {
        email,
      });
    } catch {
      // A resposta é sempre genérica; mesmo em erro de rede mostramos a mesma
      // mensagem para não revelar nada sobre o e-mail informado.
    } finally {
      // Independente do resultado, mostramos a confirmação genérica.
      setEnviado(true);
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 text-white">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-violet/20 bg-white/[0.03] p-8 shadow-2xl shadow-violet-strong/20">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            <span aria-hidden>🔮</span>{" "}
            <span className="bg-gradient-to-r from-violet-light via-gold to-violet-light bg-clip-text text-transparent">
              Chute do Vidente
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted">Recuperar minha senha</p>
        </div>

        {enviado ? (
          <div className="space-y-5">
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-300">
              Se esse e-mail estiver cadastrado, enviamos um link para redefinir
              a senha. Ele expira em 30 minutos — confira sua caixa de entrada (e
              o spam, a Madame às vezes some por lá 🔮).
            </p>
            <a
              href="/login"
              className="block w-full rounded-lg bg-violet p-2.5 text-center font-semibold text-white transition-colors hover:bg-violet-strong"
            >
              Voltar para o login
            </a>
          </div>
        ) : (
          <form onSubmit={handleEnviar} className="space-y-5">
            <p className="text-sm leading-relaxed text-muted">
              Informe o e-mail da sua conta e enviaremos um link para você criar
              uma nova senha.
            </p>

            <input
              type="email"
              placeholder="Email"
              value={email}
              maxLength={150}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 p-2.5 outline-none transition placeholder:text-faint focus:border-violet focus:ring-2 focus:ring-violet/40"
              required
            />

            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded-lg bg-violet p-2.5 font-semibold text-white transition-colors hover:bg-violet-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carregando ? "Enviando..." : "Enviar link de recuperação"}
            </button>

            <p className="text-center text-sm text-muted">
              Lembrou a senha?{" "}
              <a
                href="/login"
                className="font-medium text-violet-light transition-colors hover:text-gold"
              >
                Entrar
              </a>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
