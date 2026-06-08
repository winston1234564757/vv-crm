"use client";

function IconError() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
    <div className="flex items-center justify-center p-12">
      <div className="glass max-w-sm rounded-2xl p-8 text-center">
        <div className="flex justify-center text-rose">
          <IconError />
        </div>
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
