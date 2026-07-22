import { getAnalyticsData } from "@/lib/data-analytics";
import { AnalyticsClient } from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();
  return <AnalyticsClient data={data} />;
}
