"use client";

import { useState } from "react";
import { IconSpinner } from "@/components/icons";
import {
  PrinterError,
  printReceipt,
  toPrinterConfig,
  type ResolvedReceipt,
  type StoredPrinterSettings,
} from "@/lib/printer";

/**
 * Printer configuration, kept together in one card because the fields are not
 * independent: `codepage_index` and `codepage` describe the same ROM page from
 * two sides, and setting one without the other prints garbage.
 *
 * Takes the whole block and one setter rather than a prop pair per field. The
 * surrounding tab already threads about forty props, and adding twelve more
 * would make the wrong pattern harder to leave.
 */
interface PrinterSettingsCardProps {
  printer: StoredPrinterSettings;
  setPrinter: (next: StoredPrinterSettings) => void;
}

export function PrinterSettingsCard({ printer, setPrinter }: PrinterSettingsCardProps) {
  const [testing, setTesting] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  function update<K extends keyof StoredPrinterSettings>(key: K, value: StoredPrinterSettings[K]) {
    setPrinter({ ...printer, [key]: value });
  }

  /* Prints with the values currently on screen, not the saved ones — the point
     is to try a setting before committing to it. */
  async function handleTestPrint() {
    setTesting(true);
    setNote(null);
    try {
      const label = await printReceipt(buildTestReceipt(), toPrinterConfig(printer));
      setNote({ ok: true, text: `Тестовий чек надіслано на ${label}.` });
    } catch (err) {
      setNote({ ok: false, text: err instanceof PrinterError ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="card p-5 space-y-4 bg-warm-surface border border-iris/10 rounded-2xl shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-text-primary text-balance tracking-tight">
          Чековий принтер
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Параметри прямого друку. Це властивості конкретної моделі, а не смак — їх
          визначають на сторінці{" "}
          <a href="/admin/settings/printer-probe" className="text-violet underline">
            діагностики принтера
          </a>
          . Змінюйте, лише якщо міняли принтер.
        </p>
      </div>

      {/* Hidden inputs so the values ride along with the receipt settings form. */}
      <input type="hidden" name="printer_codepage_index" value={printer.codepage_index} />
      <input type="hidden" name="printer_codepage" value={printer.codepage} />
      <input type="hidden" name="printer_columns" value={printer.columns} />
      <input type="hidden" name="printer_qr_module_size" value={printer.qr_module_size} />
      <input type="hidden" name="printer_feed_lines" value={printer.feed_lines} />
      <input type="hidden" name="printer_cut" value={String(printer.cut)} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Кодова сторінка (ESC t n)"
          hint="Номер сторінки в пам'яті принтера. Для XP-58 — 23."
        >
          <input
            type="number"
            min={0}
            max={255}
            value={printer.codepage_index}
            onChange={(e) => update("codepage_index", clamp(e.target.value, 0, 255, 23))}
            className={inputClass}
          />
        </Field>

        <Field label="Кодування" hint="Має відповідати тому, що лежить під номером вище.">
          <select
            value={printer.codepage}
            onChange={(e) => update("codepage", e.target.value as StoredPrinterSettings["codepage"])}
            className={inputClass}
          >
            <option value="cp1251">CP1251 (українська)</option>
            <option value="cp1125">CP1125 (українська, DOS)</option>
            <option value="cp866">CP866 (без і/І)</option>
          </select>
        </Field>

        <Field label="Символів у рядку" hint="58 мм, шрифт A — 32. 80 мм — 48.">
          <input
            type="number"
            min={16}
            max={96}
            value={printer.columns}
            onChange={(e) => update("columns", clamp(e.target.value, 16, 96, 32))}
            className={inputClass}
          />
        </Field>

        <Field label="Розмір модуля QR" hint="Точок на модуль, 1–16. Менше — щільніший код.">
          <input
            type="number"
            min={1}
            max={16}
            value={printer.qr_module_size}
            onChange={(e) => update("qr_module_size", clamp(e.target.value, 1, 16, 5))}
            className={inputClass}
          />
        </Field>

        <Field label="Порожніх рядків у кінці" hint="Щоб текст вийшов за відривну планку.">
          <input
            type="number"
            min={0}
            max={20}
            value={printer.feed_lines}
            onChange={(e) => update("feed_lines", clamp(e.target.value, 0, 20, 4))}
            className={inputClass}
          />
        </Field>

        <Field label="Обрізка" hint="Лише якщо в принтері є ніж. У базового XP-58 його немає.">
          <label className="flex h-[42px] items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={printer.cut}
              onChange={(e) => update("cut", e.target.checked)}
              className="rounded border-warm-border text-violet focus:ring-violet"
            />
            <span className="text-xs text-text-primary">Обрізати чек після друку</span>
          </label>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleTestPrint}
          disabled={testing}
          className="btn-press flex items-center justify-center gap-1.5 rounded-xl bg-violet/10 px-4 py-2.5 text-xs font-semibold text-violet transition-colors hover:bg-violet/20 cursor-pointer disabled:opacity-50"
        >
          {testing && <IconSpinner size={14} className="animate-spin" />}
          <span>Тестовий друк</span>
        </button>
        <span className="text-[11px] text-text-secondary">
          Друкує поточними значеннями, ще до збереження.
        </span>
      </div>

      {note && (
        <p
          className={
            "rounded-lg px-3 py-2 text-[11px] leading-snug " +
            (note.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")
          }
        >
          {note.text}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-warm-border/60 bg-transparent px-4 py-2.5 text-xs text-text-primary outline-none focus:border-violet";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold text-text-secondary">{label}</label>
      {children}
      <p className="mt-1 text-[10px] text-text-secondary/80">{hint}</p>
    </div>
  );
}

function clamp(raw: string, min: number, max: number, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/**
 * A receipt that exercises what usually breaks: the Ukrainian-only letters, a
 * name long enough to wrap, a total that has to right-align, and a QR. If this
 * prints cleanly the settings are right.
 */
function buildTestReceipt(): ResolvedReceipt {
  return {
    type: "sale",
    id: "test0000-0000-0000",
    date: new Date().toLocaleString("uk-UA"),
    company: {
      name: "ТЕСТОВИЙ ДРУК",
      subtitle: "Перевірка налаштувань принтера",
      address: "іІїЇєЄґҐ — перевірка літер",
      phone: "+380 00 000 0000",
    },
    title: "ТЕСТ",
    footerText: "Якщо все читається — налаштування правильні.",
    showSeller: true,
    showBuyer: true,
    showQr: true,
    qrData: "https://example.com/printer-test",
    customerName: "Тестовий Покупець",
    customerPhone: "0000000000",
    employeeName: "Адміністратор",
    warrantyText: "Ціна вказана в гривнях. Знижка не застосовується.",
    items: [
      { name: "Товар із дуже довгою назвою для перевірки переносу", quantity: 2, unitPrice: 1250, totalPrice: 2500 },
      { name: "Коротка позиція", quantity: 1, unitPrice: 99, totalPrice: 99 },
    ],
    totalAmount: 2599,
  };
}
