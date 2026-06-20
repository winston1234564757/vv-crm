export const dynamic = "force-dynamic";

import { getCustomers } from "@/lib/data-customers";
import { getCashRegisters } from "@/lib/data-finance";
import { getDevices } from "@/lib/data-devices";
import { getAccessories } from "@/lib/data-accessories";
import { getServices } from "@/lib/data-services";
import { getParts } from "@/lib/data-parts";
import { POSClient } from "./POSClient";

export default async function POSPage() {
  const [customers, cashRegisters, devices, accessories, parts, services] = await Promise.all([
    getCustomers(),
    getCashRegisters(),
    getDevices(),
    getAccessories(),
    getParts(),
    getServices()
  ]);

  return (
    <POSClient
      customers={customers}
      cashRegisters={cashRegisters}
      devices={devices}
      accessories={accessories}
      parts={parts}
      services={services}
    />
  );
}
