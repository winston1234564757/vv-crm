import { requirePageRole } from "@/lib/utils/rbac";
import { getAnalyticsData } from "@/lib/data-analytics";
import { AnalyticsClient } from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  // Строгіше за `MONEY_ROLES`: тут виторг партнерів, маржа рефербішменту й
  // капітал у ремонті. Розділ і в навігації позначений `roles: ["owner"]` —
  // гард лише доганяє цей намір, а не розширює доступ.
  await requirePageRole(["owner"]);

  const data = await getAnalyticsData();
  return <AnalyticsClient data={data} />;
}
