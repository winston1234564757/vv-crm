"use client";

import { useEffect } from "react";
import Link from "next/link";
import { IconWarning, IconLogo } from "@/components/icons";

export default function TrackError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Public tracking error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-warm-bg flex flex-col justify-between">
      <header className="border-b border-warm-border/50 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/shop" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text-primary">
            <span className="text-violet"><IconLogo /></span> VV CRM
          </Link>
          <Link href="/track" className="text-sm text-violet hover:underline">Перевірити статус</Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center p-6 w-full">
        <div className="card w-full rounded-xl p-8 text-center space-y-6">
          <div className="flex justify-center text-rose">
            <IconWarning size={48} />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">Щось пішло не так</h1>
            <p className="text-sm text-text-secondary">
              Сталася помилка при завантаженні інформації про ремонт. Будь ласка, спробуйте ще раз або зверніться до підтримки.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => reset()}
              className="btn-press flex w-full items-center justify-center rounded-xl bg-violet px-5 py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover"
            >
              Спробувати знову
            </button>
            <Link
              href="/track"
              className="flex w-full items-center justify-center rounded-xl border border-warm-border px-5 py-3.5 text-sm font-medium text-text-secondary transition-colors hover:bg-warm-hover hover:text-text-primary"
            >
              Повернутися до пошуку
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-[10px] text-text-secondary/50">
        © {new Date().getFullYear()} VV CRM. Всі права захищені.
      </footer>
    </div>
  );
}
