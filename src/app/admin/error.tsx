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
      <div className="max-w-sm text-center">
        <p className="text-4xl text-error">⚠</p>
        <h2 className="mt-4 text-lg font-semibold text-iron">
          Помилка завантаження
        </h2>
        <p className="mt-1 text-sm text-ink">
          {error.message || "Сталася неочікувана помилка"}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-sm bg-selvedge px-5 py-2 text-sm font-medium text-cream transition-colors hover:bg-selvedge-deep"
        >
          Спробувати знову
        </button>
      </div>
    </div>
  );
}
