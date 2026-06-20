"use client";

import { useEffect } from "react";
import { IconWarning } from "@/components/icons";

export default function DevicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Devices Page Error:", error);
  }, [error]);

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose/10 text-rose">
        <IconWarning size={32} />
      </div>
      <h2 className="mb-2 text-xl font-bold text-text-primary">
        Помилка завантаження пристроїв
      </h2>
      <p className="mb-6 max-w-md text-sm text-text-secondary">
        {error.message || "Сталася непередбачувана помилка при завантаженні або обробці даних."}
      </p>
      <button
        onClick={() => reset()}
        className="btn-press rounded-xl bg-violet px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-hover"
      >
        Спробувати знову
      </button>
    </div>
  );
}
