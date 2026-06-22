import { createClient } from "@/lib/supabase/server";
import { getCustomers } from "@/lib/data-customers";
import { getCashRegisters } from "@/lib/data-finance";
import { getRealtimeDashboardData } from "@/lib/data-dashboard";
import { getDevices } from "@/lib/data-devices";
import { getAccessories } from "@/lib/data-accessories";
import { getServices } from "@/lib/data-services";
import { DashboardClient } from "./DashboardClient";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch the current user role from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = (profile?.role || "sales") as "owner" | "manager" | "technician" | "sales";

  // Pre-load lookup entities for action forms
  const [customers, devices, accessories, services] = await Promise.all([
    getCustomers(),
    getDevices(),
    getAccessories(),
    getServices(),
  ]);

  const stats = await getRealtimeDashboardData(userRole, user.id);

  // Sanitize cash registers for non-owners/managers to enforce server-side data isolation
  let cashRegisters = await getCashRegisters();
  if (userRole !== "owner" && userRole !== "manager") {
    cashRegisters = cashRegisters.map((cr) => ({ ...cr, balance: 0 }));
  }

  // Extract repairs list based on role
  const repairs = stats.ownerStats?.repairsQueue || stats.techStats?.repairs || [];

  return (
    <DashboardClient
      userRole={userRole}
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

