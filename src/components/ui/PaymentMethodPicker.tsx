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
 *
 * За замовчуванням компонент тримає вибір у собі. Але деяким формам сам вибір
 * потрібен ДО сабміту — вилучення частки за ним рахує, скільки покриє сейф, бо
 * половини балансу різні. Таким передають `value` + `onChange`, і компонент
 * стає керованим; решта викликачів нічого не помічає.
 */
export function PaymentMethodPicker({
  name = "payment_method",
  label = "Чим заплачено",
  defaultValue = "cash",
  value,
  onChange,
}: {
  name?: string;
  label?: string;
  defaultValue?: "cash" | "cashless";
  value?: "cash" | "cashless";
  onChange?: (v: "cash" | "cashless") => void;
}) {
  const [internal, setInternal] = useState<"cash" | "cashless">(defaultValue);
  const method = value ?? internal;
  const setMethod = (v: "cash" | "cashless") => {
    setInternal(v);
    onChange?.(v);
  };

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
