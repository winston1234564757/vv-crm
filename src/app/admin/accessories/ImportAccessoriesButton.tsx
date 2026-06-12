"use client";

import { useState, useTransition } from "react";
import Drawer from "@/components/ui/Drawer";
import { importAccessories } from "@/lib/actions/inventory";
import { IconPlus } from "@/components/icons";

interface ImportRow {
  name: string;
  type: string;
  price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  isValid: boolean;
  error?: string;
}

const VALID_TYPES = ["case", "charger", "cable", "headphones", "screen_protector", "other"];
const TYPE_LABELS: Record<string, string> = {
  case: "Чохол",
  charger: "Зарядка",
  cable: "Кабель",
  headphones: "Навушники",
  screen_protector: "Скло/Плівка",
  other: "Інше"
};

export function ImportAccessoriesButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [importError, setImportError] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [generalError, setGeneralError] = useState<string>("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setGeneralError("");
    setRows([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        // Simple CSV parser supporting commas or semicolons
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length <= 1) {
          setGeneralError("Файл порожній або містить лише заголовок");
          return;
        }

        const headers = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase());
        const parsedRows: ImportRow[] = [];

        // Simple mapping: name, type, price, cost_price, stock, min_stock
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(/[;,]/).map(v => v.trim());
          // If the line has fewer elements, pad it
          while (values.length < headers.length) values.push("");

          const rowData: Record<string, string> = {};
          headers.forEach((header, index) => {
            rowData[header] = values[index] || "";
          });

          // Validate row
          const name = rowData["name"] || rowData["назва"] || "";
          const type = (rowData["type"] || rowData["тип"] || "").toLowerCase();
          const price = parseFloat(rowData["price"] || rowData["ціна"] || "0");
          const cost_price = parseFloat(rowData["cost_price"] || rowData["собівартість"] || "0");
          const stock = parseInt(rowData["stock"] || rowData["кількість"] || "0", 10);
          const min_stock = parseInt(rowData["min_stock"] || rowData["мінімум"] || "3", 10);

          let isValid = true;
          let errorMsg = "";

          if (!name) {
            isValid = false;
            errorMsg = "Назва обов'язкова";
          } else if (!VALID_TYPES.includes(type)) {
            isValid = false;
            errorMsg = `Невірний тип: "${type}". Дозволені: ${VALID_TYPES.join(", ")}`;
          } else if (isNaN(price) || price < 0) {
            isValid = false;
            errorMsg = "Ціна має бути додатнім числом";
          } else if (isNaN(cost_price) || cost_price < 0) {
            isValid = false;
            errorMsg = "Собівартість має бути додатнім числом";
          } else if (isNaN(stock) || stock < 0) {
            isValid = false;
            errorMsg = "Кількість має бути додатнім числом";
          }

          parsedRows.push({
            name,
            type,
            price,
            cost_price,
            stock,
            min_stock,
            isValid,
            error: errorMsg
          });
        }

        setRows(parsedRows);
      } catch (err) {
        setGeneralError("Сталася помилка при читанні файлу CSV");
      }
    };

    reader.readAsText(file, "UTF-8");
  }

  function handleImport() {
    const validItems = rows.filter(r => r.isValid).map(({ name, type, price, cost_price, stock, min_stock }) => ({
      name,
      type,
      price,
      cost_price,
      stock,
      min_stock,
      status: "active"
    }));

    if (validItems.length === 0) return;

    startTransition(async () => {
      const res = await importAccessories(validItems);
      if (res.success) {
        setIsOpen(false);
        setRows([]);
        setFileName("");
        setImportError("");
      } else {
        setImportError(res.error || "Помилка імпорту");
      }
    });
  }

  const hasErrors = rows.some(r => !r.isValid);
  const totalValid = rows.filter(r => r.isValid).length;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-press flex items-center gap-1.5 rounded-xl border border-violet/20 px-5 py-3 text-sm font-medium text-violet transition-colors hover:bg-violet/5"
      >
        Імпортувати з CSV
      </button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Імпорт аксесуарів з таблиці CSV" size="default">
        <div className="space-y-6 p-4">
          {importError && (
            <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">
              {importError}
            </div>
          )}
          <div className="rounded-xl border border-warm-border/50 bg-violet/5 p-5 text-sm text-text-primary">
            <h3 className="font-semibold mb-2 text-violet">Інструкція з імпорту:</h3>
            <p className="mb-2">Будь ласка, завантажте CSV-файл, який містить такі стовпці в першому рядку (заголовки):</p>
            <code className="block bg-white p-2.5 rounded-lg border border-iris/10 text-xs font-mono text-violet overflow-x-auto">
              name, type, price, cost_price, stock, min_stock
            </code>
            <div className="mt-3 space-y-1 text-xs text-text-secondary">
              <p>• <strong className="text-text-primary">type</strong> може мати лише такі значення: <span className="font-mono bg-white px-1 py-0.5 rounded">case</span> (чохол), <span className="font-mono bg-white px-1 py-0.5 rounded">charger</span> (зарядка), <span className="font-mono bg-white px-1 py-0.5 rounded">cable</span> (кабель), <span className="font-mono bg-white px-1 py-0.5 rounded">headphones</span> (навушники), <span className="font-mono bg-white px-1 py-0.5 rounded">screen_protector</span> (скло/плівка), <span className="font-mono bg-white px-1 py-0.5 rounded">other</span> (інше).</p>
              <p>• Розділювачем стовпців може бути кома або крапка з комою.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-text-secondary">Оберіть CSV файл</label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".csv"
                id="csv_file_input"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="csv_file_input"
                className="btn-press flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover"
              >
                Вибрати файл...
              </label>
              {fileName && <span className="text-sm font-medium text-text-primary">{fileName}</span>}
            </div>
          </div>

          {generalError && (
            <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">
              {generalError}
            </div>
          )}

          {rows.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">Попередній перегляд завантажених даних</h3>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${hasErrors ? "bg-amber/10 text-amber" : "bg-cyan/10 text-cyan"}`}>
                  {hasErrors ? `Знайдено помилок. Валідних: ${totalValid} з ${rows.length}` : `Усі ${rows.length} рядків готові до завантаження!`}
                </span>
              </div>

              <div className="max-h-[350px] overflow-y-auto rounded-xl border border-warm-border">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-iris/5 text-xs text-text-secondary border-b border-warm-border">
                    <tr>
                      <th className="p-3">Назва</th>
                      <th className="p-3">Тип</th>
                      <th className="p-3">Ціна</th>
                      <th className="p-3">Собівартість</th>
                      <th className="p-3">Кількість</th>
                      <th className="p-3">Статус валідації</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-warm-border/30 text-text-primary ${
                          row.isValid ? "hover:bg-violet/[0.02]" : "bg-rose/5 hover:bg-rose/10"
                        }`}
                      >
                        <td className="p-3 font-medium">{row.name || "—"}</td>
                        <td className="p-3 text-text-secondary">{TYPE_LABELS[row.type] || row.type || "—"}</td>
                        <td className="p-3 font-mono">{row.price} грн</td>
                        <td className="p-3 font-mono text-text-secondary">{row.cost_price} грн</td>
                        <td className="p-3 font-mono">{row.stock} шт</td>
                        <td className="p-3">
                          {row.isValid ? (
                            <span className="text-xs font-semibold text-cyan">OK</span>
                          ) : (
                            <span className="text-xs font-semibold text-rose" title={row.error}>
                              Помилка: {row.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => {
                    setRows([]);
                    setFileName("");
                  }}
                  className="btn-press rounded-xl border border-iris/20 px-5 py-3 text-sm font-medium text-text-secondary hover:bg-iris/5"
                >
                  Очистити
                </button>
                <button
                  onClick={handleImport}
                  disabled={totalValid === 0 || isPending}
                  className="btn-press flex items-center justify-center gap-2 rounded-xl bg-violet px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50"
                >
                  {isPending ? <span className="animate-pulse opacity-60">Зачекайте...</span> : `Завантажити ${totalValid} шт`}
                </button>
              </div>
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
}
