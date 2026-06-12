"use client";

function IconError() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
      <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="12" cy="16" r="0.75" fill="currentColor"/>
    </svg>
  );
}

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center p-12" aria-live="polite">
      <div className="card max-w-sm p-8 text-center">
        <div className="flex justify-center text-rose">
          <IconError />
        </div>
        <h2 className="mt-3 text-lg font-semibold text-text-primary">
          Помилка завантаження
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {error.message || "Сталася неочікувана помилка"}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover"
        >
          Спробувати знову
        </button>
      </div>
    </div>
  );
}
