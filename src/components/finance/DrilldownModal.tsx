"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { uah } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import type { DrillResult } from "@/lib/data-drilldown";

/**
 * Що стоїть за числом.
 *
 * До цього кожна стаття містка й вартості бізнесу була кінцевою точкою: цифру
 * видно, перевірити нічим. Для звіту, за яким двоє власників ділять гроші, це
 * гірше за відсутність цифри — її доводиться приймати на віру.
 *
 * Тут же сховались пояснення статей. Раніше вони жили колонкою «ЧОМУ» просто в
 * таблиці й займали більше місця, ніж самі суми — колонка з грошима не
 * вміщалась на екран. Таблицю відкривають по числа; пояснення потрібне рівно
 * тоді, коли стаття незрозуміла, тобто в момент кліку.
 *
 * СТАН ПОЧИНАЄТЬСЯ З «ЗАВАНТАЖУЮ», а не скидається ефектом: викликач монтує
 * компонент із `key={ключ}`, тож на кожну нову статтю це свіжий екземпляр зі
 * свіжим станом. Скидання через `setState` усередині ефекту дало б зайвий
 * каскадний рендер на кожне відкриття.
 */
export function DrilldownModal({
  onClose,
  title,
  load,
}: {
  onClose: () => void;
  title: string;
  /** Серверна дія, що повертає рядки. Викликається один раз на монтування. */
  load: () => Promise<DrillResult>;
}) {
  const [data, setData] = useState<DrillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    load()
      .then((r) => {
        if (alive) setData(r);
      })
      .catch((e: unknown) => {
        // Помилку показуємо, а не ковтаємо: порожній список і зламаний запит
        // інакше виглядали б однаково, і «операцій немає» було б неправдою.
        if (alive) setError(e instanceof Error ? e.message : "Не вдалося завантажити деталі");
      });

    return () => {
      alive = false;
    };
  }, [load]);

  return (
    <Modal isOpen onClose={onClose} title={title} size="lg">
      {error !== null ? (
        <p className="py-10 text-center text-sm text-danger">{error}</p>
      ) : data === null ? (
        <p className="py-10 text-center text-sm text-muted">Завантажую…</p>
      ) : (
        <>
          <p className="mb-4 text-xs leading-relaxed text-muted">{data.hint}</p>

          {data.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Операцій за цією статтею немає.</p>
          ) : (
            <>
              <div className="-mx-1 max-h-[55vh] overflow-y-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                      <th scope="col" className="py-1.5 pr-3 font-medium">
                        Дата
                      </th>
                      <th scope="col" className="py-1.5 pr-3 font-medium">
                        Операція
                      </th>
                      <th scope="col" className="py-1.5 text-right font-medium">
                        Сума
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.id} className="border-b border-border/60">
                        <td className="whitespace-nowrap py-2 pr-3 tabular text-muted">
                          {r.date ? r.date.slice(0, 10) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-ink">
                          {r.title}
                          {r.subtitle && (
                            <span className="block text-[11px] text-faint">{r.subtitle}</span>
                          )}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap py-2 text-right tabular",
                            r.amount < 0 ? "text-danger" : "text-ink",
                          )}
                        >
                          {uah(r.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 flex items-baseline justify-between border-t border-border pt-2 text-sm">
                <span className="text-muted">
                  Разом · {data.rows.length}{" "}
                  {data.rows.length === 1 ? "операція" : "операцій"}
                </span>
                <span className="font-semibold tabular text-ink">{uah(data.total)}</span>
              </p>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
