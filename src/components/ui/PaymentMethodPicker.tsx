"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Вибір способу оплати для операцій, що рухають гроші сейфа.
 *
 * Компонент спільний, бо той самий вибір потрібен у семи формах — витрата,
 * поповнення, вилучення частки, переказ, закупівля аксесуара, запчастини й
 * оплата закупівлі. Сім копій розійшлися б у підписах і в тому, яке значення
 * шлють на сервер, а тут значення одне й перевіряється в одному місці.
 *
 * Значення їде прихованим полем, а не станом форми: усі ці форми — серверні
 * дії з `FormData`, і поле має приїхати разом із рештою.
 */
export function PaymentMethodPicker({
  name = "payment_method",
  label = "Чим заплачено",
  defaultValue = "cash",
}: {
  name?: string;
  label?: string;
  defaultValue?: "cash" | "cashless";
}) {
  const [method, setMethod] = useState<"cash" | "cashless">(defaultValue);

  return (
    <div>
      <p className="mb-1.5 block text-xs font-medium text-muted">{label}</p>
      <input type="hidden" name={name} value={method} />
      <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
        {(
          [
            { key: "cash", label: "Готівкою" },
            { key: "cashless", label: "Карткою" },
          ] as const
        ).map((o) => (
          <Button
            key={o.key}
            type="button"
            variant={method === o.key ? "primary" : "secondary"}
            aria-pressed={method === o.key}
            onClick={() => setMethod(o.key)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
