"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { WithdrawShareForm } from "@/components/forms/WithdrawShareForm";

/**
 * Сейф очима форми вилучення. Половини обов'язкові: знімають або готівку, або
 * безготівку, і саме обрана половина вирішує, скільки покриє сейф ЧП.
 */
export interface WithdrawSafe {
  id: string;
  name: string;
  type: string;
  balance: number;
  cashBalance: number;
  cardBalance: number;
}

/**
 * Частку знімають тільки з сейфа «Чистий прибуток»: вона з нього нараховується,
 * тож зняття повз нього розсинхронізувало б залишок власника з балансом сейфа.
 * Те саме обмеження продубльоване в базі.
 *
 * Решта сейфів усе одно передається — з них беруть АВАНС, коли в ЧП забракло.
 * Без цього шляху власник, якому треба взяти наперед, просто взяв би повз
 * систему, і сейфи знову почали б брехати — рівно те, від чого ми щойно пішли.
 *
 * Викликач передає всі сейфи; розкладає їх на джерело і кандидатів під аванс
 * сам компонент — знати, який із них ЧП, викликачу не потрібно.
 */
export function WithdrawShareButton({
  safes = [],
  label = "💵 Зняти частку",
  className,
}: {
  safes?: WithdrawSafe[];
  label?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const sources = safes.filter((s) => s.type === "net_profit");
  const advanceSources = safes.filter((s) => s.type !== "net_profit");

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={
          className ||
          "btn-press flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border border-success/30 bg-success-subtle px-4 py-2.5 text-xs font-semibold text-success transition-colors hover:bg-success/20"
        }
      >
        {label}
      </button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="💵 Вилучення частки прибутку" size="default">
        <WithdrawShareForm
          sources={sources}
          advanceSources={advanceSources}
          onSuccess={() => setIsOpen(false)}
        />
      </Drawer>
    </>
  );
}
