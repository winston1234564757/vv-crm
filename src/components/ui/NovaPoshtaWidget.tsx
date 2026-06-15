"use client";

import { useEffect, useState } from "react";

export type TrackingStatus = {
  Number: string;
  Status: string;
  StatusCode: string;
  WarehouseRecipient: string;
  ActualDeliveryDate: string;
  ScheduledDeliveryDate: string;
  CityRecipient: string;
  RecipientAddress: string;
  PhoneSender: string;
  PhoneRecipient: string;
} | null;

interface NovaPoshtaWidgetProps {
  ttn: string;
  initialStatus?: TrackingStatus;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  "1": { bg: "bg-rose/10", text: "text-rose" }, // Not found
  "2": { bg: "bg-iris/10", text: "text-text-secondary" }, // Deleted
  "3": { bg: "bg-iris/10", text: "text-text-secondary" }, // Created
  "4": { bg: "bg-violet/10", text: "text-violet" }, // In transit
  "41": { bg: "bg-violet/10", text: "text-violet" }, // In transit
  "5": { bg: "bg-violet/10", text: "text-violet" }, // Sent
  "6": { bg: "bg-cyan/10", text: "text-cyan" }, // Arrived at warehouse
  "7": { bg: "bg-emerald/10", text: "text-emerald" }, // Received
  "8": { bg: "bg-emerald/10", text: "text-emerald" }, // Received (reconciled)
  "9": { bg: "bg-rose/10", text: "text-rose" }, // Refused
  "10": { bg: "bg-rose/10", text: "text-rose" }, // Return initiated
  "11": { bg: "bg-rose/10", text: "text-rose" }, // Returned
};

export default function NovaPoshtaWidget({ ttn, initialStatus }: NovaPoshtaWidgetProps) {
  const [status, setStatus] = useState<TrackingStatus>(initialStatus || null);
const [loading, setLoading] = useState<boolean>(!initialStatus);
  const [error, setError] = useState<string | null>(null);

  const fetchTrackingData = (trackingNumber: string) => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/np-tracking?ttn=${trackingNumber}`)
      .then((res) => {
        if (!res.ok) throw new Error("Помилка зв\'язку з API");
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setStatus(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Не вдалося отримати статус");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  };

  useEffect(() => {
    if (initialStatus) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus(initialStatus);
      setLoading(false);
      return;
    }

    if (!ttn || ttn.trim().length < 10) {
      setLoading(false);
      return;
    }

    fetchTrackingData(ttn);
  }, [ttn, initialStatus]);

  if (!ttn) return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-warm-border bg-white p-4 space-y-2 animate-pulse">
        <div className="h-4 bg-warm-bg rounded w-1/3" />
        <div className="h-3 bg-warm-bg rounded w-3/4" />
        <div className="h-3 bg-warm-bg rounded w-1/2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose/20 bg-rose/5 p-4 text-xs text-rose">
        Помилка відстеження ТТН {ttn}: {error}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-xl border border-warm-border bg-white p-4 text-xs text-text-secondary">
        ТТН <span className="font-mono">{ttn}</span> не знайдено в базі Нової Пошти або відсутній API-ключ.
      </div>
    );
  }

  const colorStyles = statusColors[status.StatusCode] || { bg: "bg-iris/10", text: "text-text-secondary" };
  const deliveryDate = status.ActualDeliveryDate || status.ScheduledDeliveryDate;

  return (
    <div className="rounded-xl border border-warm-border bg-white p-4 text-xs text-text-primary">
      <div className="flex items-center justify-between gap-2 border-b border-warm-border pb-2.5 mb-2.5">
        <div>
          <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Нова Пошта ТТН</p>
          <p className="font-mono text-sm font-semibold mt-0.5">{status.Number}</p>
        </div>
        <span className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold ${colorStyles.bg} ${colorStyles.text}`}>
          {status.Status}
        </span>
      </div>

      <div className="space-y-2">
        {status.CityRecipient && (
          <div>
            <p className="text-[10px] text-text-secondary font-medium">Маршрут доставки</p>
            <p className="font-medium mt-0.5">{status.CityRecipient}</p>
            {status.WarehouseRecipient && (
              <p className="text-text-secondary mt-0.5 leading-relaxed">{status.WarehouseRecipient}</p>
            )}
          </div>
        )}

        {deliveryDate && (
          <div>
            <p className="text-[10px] text-text-secondary font-medium">
              {status.ActualDeliveryDate ? "Отримано" : "Очікувана доставка"}
            </p>
            <p className="font-semibold text-violet mt-0.5">
              {new Date(deliveryDate).toLocaleDateString("uk-UA", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
