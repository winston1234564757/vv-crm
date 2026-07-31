import { requirePageRole } from "@/lib/utils/rbac";
import { MONEY_ROLES } from "@/lib/roles";
import { getDayList } from "@/lib/data-day";
import { PageHeader } from "@/components/layout/PageHeader";
import StandardCard from "@/components/ui/StandardCard";
import { DaysTable } from "./DaysTable";

export const dynamic = "force-dynamic";

export default async function DaysPage() {
  await requirePageRole(MONEY_ROLES);
  const rows = await getDayList();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Дні"
        subtitle="Кожен день від відкриття магазину. Клік по рядку відкриє його цілком."
      />
      <StandardCard>
        <DaysTable rows={rows} />
      </StandardCard>
    </div>
  );
}
