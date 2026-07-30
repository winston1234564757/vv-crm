import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { requirePageRole } from "@/lib/utils/rbac";
import { getAnalyticsData } from "@/lib/data-analytics";
import { getSettings } from "@/lib/data-settings";
import { AnalyticsClient } from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  // Строгіше за `MONEY_ROLES`: тут виторг партнерів, маржа рефербішменту й
  // капітал у ремонті. Розділ і в навігації позначений `roles: ["owner"]` —
  // гард лише доганяє цей намір, а не розширює доступ.
  await requirePageRole(["owner"]);

  const data = await getAnalyticsData();
  const { finance_epoch } = await getSettings();
  // Дата в підписі бере ту саму епоху, що й вікна даних нижче — інакше екран
  // знову покаже дату, яка суперечить власним цифрам.
  const epochLabel = finance_epoch
    ? format(new Date(finance_epoch), "d MMMM yyyy", { locale: uk })
    : null;
  return <AnalyticsClient data={data} epochLabel={epochLabel} />;
}
