export const dynamic = "force-dynamic";

import { getAllRepairs } from "@/lib/data-repairs";
import { getCustomers } from "@/lib/data-customers";
import { getDevices } from "@/lib/data-devices";
import { RepairsClient } from "./RepairsClient";
import type { RepairRow } from "./RepairsClient";

export default async function RepairsPage() {
  const [allRepairs, customers, allDevices] = await Promise.all([
    getAllRepairs(),
    getCustomers(),
    getDevices(),
  ]);

  const inStockDevices = (allDevices ?? []).filter(
    (d) => d.status === "in_stock" || d.status === "transit"
  );

  return (
    <RepairsClient
      repairs={allRepairs as unknown as RepairRow[]}
      customers={customers}
      inStockDevices={inStockDevices}
    />
  );
}
