export const dynamic = "force-dynamic";

import { getRepairs, getInternalRepairs } from "@/lib/data-repairs";
import { getCustomers } from "@/lib/data-customers";
import { getDevices } from "@/lib/data-devices";
import { RepairsClient } from "./RepairsClient";

export default async function RepairsPage() {
  const [customerRepairs, internalRepairs, customers, allDevices] = await Promise.all([
    getRepairs(),
    getInternalRepairs(),
    getCustomers(),
    getDevices()
  ]);

  // Devices that are in-stock or in-transit can be put into service
  const inStockDevices = (allDevices ?? []).filter(
    (d) => d.status === "in_stock" || d.status === "transit"
  );

  // Devices from inventory that require repair
  const devicesNeedingRepair = (allDevices ?? []).filter((d) => d.needs_repair);

  return (
    <RepairsClient
      customerRepairs={customerRepairs}
      internalRepairs={internalRepairs}
      devicesNeedingRepair={devicesNeedingRepair}
      customers={customers}
      inStockDevices={inStockDevices}
    />
  );
}
