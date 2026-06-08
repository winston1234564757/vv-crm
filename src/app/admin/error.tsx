"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="glass max-w-sm rounded-2xl p-8 text-center">
        <p className="text-3xl text-rose">!</p>
        <h2 className="mt-3 text-lg font-semibold text-indigo">
          Помилка завантаження
        </h2>
        <p className="mt-1 text-sm text-iris">
          {error.message || "Сталася неочікувана помилка"}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-xl bg-violet px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-deep"
        >
          Спробувати знову
        </button>
      </div>
    </div>
  );
}
