"use client";

export function InlineError({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-center justify-between rounded-xl bg-rose/10 px-4 py-3 text-sm text-rose">
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 text-rose/60 hover:text-rose">&times;</button>
    </div>
  );
}
