"use client";

import { useState } from "react";
import { useNPTracking } from "@/lib/supabase/hooks/useNPTracking";

export function NPTrackingStatus({ ttn }: { ttn: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: status, isLoading, isError } = useNPTracking(ttn);

  if (isLoading) return <span className="text-xs text-text-secondary">Завантаження...</span>;
  if (isError || !status) return <span className="text-xs text-rose">НП: помилка</span>;

  const statusColor = status.StatusCode === "7" || status.StatusCode === "8" || status.StatusCode === "9"
    ? "text-cyan bg-cyan/10"
    : ["1", "2", "3"].includes(status.StatusCode)
    ? "text-amber bg-amber/10"
    : "text-text-secondary bg-iris/5";

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className={`rounded px-2 py-0.5 text-[11px] font-medium cursor-pointer ${statusColor}`} onClick={() => setExpanded(!expanded)}>
        НП: {status.Status}
      </span>
      {expanded && (
        <div className="absolute top-full left-0 mt-1 z-10 rounded-xl bg-warm-surface border border-warm-border p-3 text-xs shadow-lg min-w-[200px]">
          <p>Місто: {status.CityRecipient}</p>
          <p>Відділення: {status.WarehouseRecipient}</p>
          {status.ScheduledDeliveryDate && <p>Очікувана: {status.ScheduledDeliveryDate}</p>}
          {status.ActualDeliveryDate && <p>Отримана: {status.ActualDeliveryDate}</p>}
        </div>
      )}
    </div>
  );
}
