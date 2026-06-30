import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { MonobankTransaction } from "@/lib/services/monobank";

export function useMonobankTransactions() {
  return useQuery<MonobankTransaction[]>({
    queryKey: ["monobank-transactions"],
    queryFn: async () => {
      const res = await fetch("/api/monobank");
      if (!res.ok) {
        throw new Error("Не вдалося завантажити виписку");
      }
      const data = await res.json();
      // Filter transactions to show only positive amounts (incoming payments)
      return (data as MonobankTransaction[]).filter((tx) => tx.amount > 0);
    },
    staleTime: 60 * 1000, // 1 хвилина для фінансових даних
    placeholderData: keepPreviousData,
  });
}
