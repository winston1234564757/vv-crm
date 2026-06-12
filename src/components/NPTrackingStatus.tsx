"use client";

import { useState, useEffect } from "react";

type NPStatus = {
  Number: string;
  Status: string;
  StatusCode: string;
  WarehouseRecipient: string;
  ActualDeliveryDate: string;
  ScheduledDeliveryDate: string;
  CityRecipient: string;
};

export function NPTrackingStatus({ ttn }: { ttn: string }) {
  const [status, setStatus] = useState<NPStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/np-tracking?ttn=${ttn}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setStatus(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ttn]);

  if (loading) return <span className="text-xs text-text-secondary">Завантаження...</span>;
  if (!status) return <span className="text-xs text-rose">НП: помилка</span>;

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
