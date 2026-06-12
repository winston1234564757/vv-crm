"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconRepair } from "@/components/icons";

export default function TrackPage() {
  const [token, setToken] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (token.trim()) {
      router.push(`/track/${token.trim().toUpperCase()}`);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-warm-bg">
      <div className="card w-full max-w-md rounded-xl p-8 space-y-6">
        <div className="flex flex-col items-center text-center">
          <span className="text-violet">
            <IconRepair size={32} />
          </span>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-text-primary">Статус ремонту</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Введіть номер заявки, щоб дізнатися статус вашого пристрою
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Номер заявки (напр. R001)"
            className="w-full rounded-xl border border-warm-border bg-warm-surface px-4 py-3.5 text-center text-lg font-semibold tracking-widest text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40 uppercase"
          />
          <button
            type="submit"
            className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-violet px-5 py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover"
          >
            Перевірити статус
          </button>
        </form>

        <p className="text-center text-xs text-text-secondary">
          <a href="/shop" className="text-violet hover:underline">Повернутися до вітрини</a>
        </p>
      </div>
    </div>
  );
}
