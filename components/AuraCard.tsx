import { AuraResult } from "@/lib/aura";

export default function AuraCard({
  aura,
  username,
}: {
  aura: AuraResult;
  username: string;
}) {
  return (
    <div className="w-full max-w-sm rounded-2xl bg-gradient-to-br from-purple-600 via-pink-500 to-indigo-600 p-6 text-white shadow-xl">
      <div className="text-center">
        <div className="mb-3 text-6xl">{aura.emoji}</div>
        <h1 className="text-2xl font-bold">{aura.label}</h1>
        <p className="mt-1 text-sm opacity-90">{aura.description}</p>

        <div className="mt-4 rounded-xl bg-black/30 py-3">
          <div className="text-4xl font-extrabold">{aura.score}</div>
          <div className="text-xs uppercase tracking-widest opacity-70">Aura Score</div>
        </div>

        {username && <p className="mt-4 text-sm opacity-80">@{username}</p>}
      </div>
    </div>
  );
}
