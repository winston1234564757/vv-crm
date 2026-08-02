"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { WithdrawShareForm } from "@/components/forms/WithdrawShareForm";

interface SourceItem {
  id: string;
  name: string;
  balance: number;
}

/**
 * Джерелом лишився тільки сейф ЧП: частка нараховується з нього, тож і
 * знімати її повз нього не можна — інакше залишок власника перестане
 * сходитись із балансом сейфа. Те саме обмеження продубльоване в
 * `withdraw_owner_share`, тут воно лише для того, щоб UI не пропонував
 * недозволене.
 *
 * Викликач передає вже відфільтрований список (зазвичай один сейф) — цей
 * компонент не знає, який із сейфів «Чистий прибуток».
 */
export function WithdrawShareButton({
  safes = [],
  label = "💵 Зняти частку",
  className,
}: {
  safes?: { id: string; name: string; balance: number }[];
  label?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const sources: SourceItem[] = safes.map((s) => ({
    id: s.id,
    name: s.name,
    balance: s.balance,
  }));

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
        <WithdrawShareForm sources={sources} onSuccess={() => setIsOpen(false)} />
      </Drawer>
    </>
  );
}
