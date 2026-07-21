export const dynamic = "force-dynamic";

import PrinterProbeClient from "@/components/settings/PrinterProbeClient";

/**
 * Diagnostic route for the thermal printer. Auth comes from `src/proxy.ts`,
 * which gates every `/admin/*` path, so this page adds no check of its own.
 *
 * WebUSB needs browser APIs and a user gesture, so all the work happens in the
 * client component; this stays a server component that renders the heading.
 */
export default function PrinterProbePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary text-balance">
          Діагностика принтера
        </h1>
        <p className="text-sm text-text-secondary">
          Перевірка WebUSB-доступу та пошук кодової сторінки з українськими літерами
        </p>
      </div>
      <PrinterProbeClient />
    </div>
  );
}
