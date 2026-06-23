interface Jogador {
  id: number;
  nome: string;
  totalPontos: number | null;
}

const medalhas = ["🥇", "🥈", "🥉"];

// Lista visual de ranking reutilizada pelo ranking geral e pelos rankings de
// grupo. Recebe os jogadores já ordenados; só cuida da aparência.
export default function RankingList({ ranking }: { ranking: Jogador[] }) {
  if (ranking.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-gray-400">
        Ninguém pontuou ainda. 🍀
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {ranking.map((jogador, index) => {
        const podio = index < 3;
        return (
          <div
            key={jogador.id}
            className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
              podio
                ? "border-yellow-400/30 bg-yellow-400/[0.07]"
                : "border-white/10 bg-white/[0.03] hover:border-green-500/30"
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="w-7 text-center text-lg font-semibold tabular-nums text-gray-400">
                {podio ? medalhas[index] : index + 1}
              </span>
              <span className="font-medium">{jogador.nome}</span>
            </div>
            <span className="font-bold tabular-nums text-yellow-300">
              {jogador.totalPontos ?? 0}{" "}
              <span className="text-sm font-normal text-gray-500">pts</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
