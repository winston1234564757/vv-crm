import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/utils/rbac";
import { MONEY_ROLES } from "@/lib/roles";
import { getDayReport } from "@/lib/data-day";
import { isDayKey } from "@/lib/utils/day";
import { DayClient } from "./DayClient";

export const dynamic = "force-dynamic";

export default async function DayPage({ params }: { params: Promise<{ day: string }> }) {
  await requirePageRole(MONEY_ROLES);
  const { day } = await params;

  // Невалідний ключ, день до епохи або в майбутньому — 404. День у межах, але
  // порожній, сюди не потрапляє: він повертає звіт із нулями, бо «нуль» і
  // «немає такого дня» — різні відповіді.
  if (!isDayKey(day)) notFound();
  const report = await getDayReport(day);
  if (!report) notFound();

  return <DayClient report={report} />;
}
