"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { IconSearch } from "./icons";

export function useFilter<T>(
  data: T[],
  filterFn: (item: T, query: string, filter: string) => boolean,
) {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const filter = searchParams.get("f") ?? "all";
  const filtered = data.filter((item) => filterFn(item, query, filter));
  return { query, filter, filtered };
}

export function SearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <input
      type="text"
      defaultValue={searchParams.get("q") ?? ""}
      onChange={(e) => {
        const p = new URLSearchParams(searchParams.toString());
        if (e.target.value) p.set("q", e.target.value);
        else p.delete("q");
        router.replace(`${pathname}?${p.toString()}`);
      }}
      placeholder="Пошук..."
      className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40"
    />
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary ${className ?? ""}`}>
      <IconSearch />
    </span>
  );
}

export function FilterButton({
  value,
  current,
  label,
}: {
  value: string;
  current: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <button
      onClick={() => {
        const p = new URLSearchParams(searchParams.toString());
        if (value === "all") p.delete("f");
        else p.set("f", value);
        router.replace(`${pathname}?${p.toString()}`);
      }}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        current === value
          ? "bg-violet text-white"
          : "bg-violet/5 text-text-secondary hover:bg-violet/10 hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}

export function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-sm text-text-secondary">
        Нічого не знайдено
      </td>
    </tr>
  );
}
