import StandardCard from "@/components/ui/StandardCard";
import { getSalesPage, getSalesAnalytics } from "@/lib/data-sales";
import { SalesTable } from "./table";
import { SalesAnalytics } from "./SalesAnalytics";
import { parsePeriod, periodRange } from "./period";
import { pluralUk } from "@/lib/utils/plural";

export const dynamic = "force-dynamic";

function num(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) as string | undefined;

  const period = parsePeriod(one("period"));
  const { from, to, bucket } = periodRange(period);

  // Search, filtering, paging and aggregation all run in Postgres.
  const [pageData, analytics] = await Promise.all([
    getSalesPage({
      page: num(one("page"), 1),
      pageSize: num(one("size"), 25),
      query: one("q"),
      category: one("cat"),
      payment: one("pay"),
    }),
    getSalesAnalytics(from, to, bucket),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink text-balance">Продажі</h1>
        {/* «Операція», а не «продаж»: у списку тепер і товари, і ремонти. */}
        <p className="mt-0.5 text-sm text-muted">
          {pageData.total} {pluralUk(pageData.total, "операція", "операції", "операцій")} знайдено
        </p>
      </header>

      <SalesAnalytics data={analytics} period={period} />

      <StandardCard>
        <SalesTable
          rows={pageData.rows}
          total={pageData.total}
          page={pageData.page}
          pageSize={pageData.pageSize}
          pageCount={pageData.pageCount}
          query={one("q") ?? ""}
          category={one("cat") ?? "all"}
          payment={one("pay") ?? "all"}
        />
      </StandardCard>
    </div>
  );
}
