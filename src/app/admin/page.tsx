export const dynamic = "force-dynamic";

import { getCustomers } from "@/lib/data-customers";
import { getCashRegisters } from "@/lib/data-finance";
import { getDashboardStats } from "@/lib/data-dashboard";
import { getRepairsDashboard } from "@/lib/data-repairs";
import { getDevices } from "@/lib/data-devices";
import { getAccessories } from "@/lib/data-accessories";
import { getServices } from "@/lib/data-services";
import { DashboardClient } from "./DashboardClient";

export default async function AdminDashboard() {
  const [stats, repairs, customers, cashRegisters, devices, accessories, services] = await Promise.all([
    getDashboardStats(),
    getRepairsDashboard(),
    getCustomers(),
    getCashRegisters(),
    getDevices(),
    getAccessories(),
    getServices(),
  ]);

  return (
    <DashboardClient
      stats={stats}
      repairs={repairs}
      customers={customers}
      cashRegisters={cashRegisters}
      devices={devices}
      accessories={accessories}
      services={services}
    />
  );
}

