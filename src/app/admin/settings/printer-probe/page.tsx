export const dynamic = "force-dynamic";

import PrinterProbeClient from "@/components/settings/PrinterProbeClient";
import { requirePageRole } from "@/lib/utils/rbac";

/**
 * Diagnostic route for the thermal printer. `src/proxy.ts` дає лише
 * автентифікацію на весь `/admin/*`, тож роль перевіряється тут — сторінка
 * висить під «Налаштуваннями», і без цього вона лишалась би єдиним відкритим
 * входом у закритий розділ.
 *
 * WebUSB needs browser APIs and a user gesture, so all the work happens in the
 * client component; this stays a server component that renders the heading.
 */
export default async function PrinterProbePage() {
  await requirePageRole(["owner"]);

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
