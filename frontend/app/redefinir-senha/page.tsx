"use client";

import { Suspense, useState } from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";

function RedefinirSenhaConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function handleRedefinir(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    // Mesma validação de força usada no registro: senha entre 6 e 72 caracteres.
    if (senha.length < 6 || senha.length > 72) {
      setErro("A senha deve ter entre 6 e 72 caracteres");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As senhas não conferem");
      return;
    }

    setCarregando(true);
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/redefinir-senha`,
        { token, senha },
      );
      setSucesso(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { erro?: string } } };
      setErro(
        err.response?.data?.erro ||
          "Não foi possível redefinir a senha. Tente novamente.",
      );
    } finally {
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
          <p className="mt-1 text-sm text-muted">Definir uma nova senha</p>
        </div>

        {!token ? (
          <div className="space-y-5">
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-300">
              Link inválido ou expirado. Solicite um novo link de recuperação.
            </p>
            <a
              href="/esqueci-senha"
              className="block w-full rounded-lg bg-violet p-2.5 text-center font-semibold text-white transition-colors hover:bg-violet-strong"
            >
              Pedir novo link
            </a>
          </div>
        ) : sucesso ? (
          <div className="space-y-5">
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-300">
              Senha redefinida com sucesso! Redirecionando para o login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleRedefinir} className="space-y-5">
            <input
              type="password"
              placeholder="Nova senha"
              value={senha}
              maxLength={72}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 p-2.5 outline-none transition placeholder:text-faint focus:border-violet focus:ring-2 focus:ring-violet/40"
              required
            />

            <input
              type="password"
              placeholder="Confirmar nova senha"
              value={confirmacao}
              maxLength={72}
              onChange={(e) => setConfirmacao(e.target.value)}
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
              disabled={carregando}
              className="w-full rounded-lg bg-violet p-2.5 font-semibold text-white transition-colors hover:bg-violet-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carregando ? "Redefinindo..." : "Redefinir senha"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function RedefinirSenha() {
  // useSearchParams precisa de um limite de Suspense no App Router do Next.
  return (
    <Suspense fallback={null}>
      <RedefinirSenhaConteudo />
    </Suspense>
  );
}
