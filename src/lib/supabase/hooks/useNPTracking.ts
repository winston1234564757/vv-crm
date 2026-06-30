import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { TrackingStatus } from "@/lib/services/nova-poshta";

export function useNPTracking(ttn: string | null | undefined) {
  return useQuery<TrackingStatus | null>({
    queryKey: ["np-tracking", ttn],
    queryFn: async () => {
      if (!ttn || ttn.length < 11) return null;
      const res = await fetch(`/api/np-tracking?ttn=${ttn}`);
      if (!res.ok) {
        throw new Error("Не вдалося завантажити статус з Нової Пошти");
      }
      return await res.json();
    },
    enabled: !!ttn && ttn.length >= 11,
    staleTime: 30 * 1000, // 30 секунд для динамічних даних
    placeholderData: keepPreviousData,
  });
}
