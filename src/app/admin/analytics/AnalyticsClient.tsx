"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import type { AnalyticsData } from "@/lib/data-analytics";
import {
  RefurbishmentWidget,
  B2BPartnerShareWidget,
  CrossSellWidget,
  SalesVelocityMatrix,
  PhoneModelDemandWidget,
  RevenueHeatmapWidget,
  StockoutIntelligenceWidget,
} from "@/components/dashboard/Widgets";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      {children}
    </section>
  );
}

export function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Аналітика"
        subtitle="Дані накопичуються з 24 липня 2026 — до того в базі лише продажі з рук"
      />

      <Section title="Клієнти">
        <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-4">
          <StatCard
            label="Утримання клієнтів"
            tone="info"
            value={`${data.customerReturnRate}%`}
            sub={<>Повторні візити (90д) · <span className="text-ink font-medium">{data.newCustomers}</span> нових</>}
          />
        </div>
      </Section>

      <Section title="Продажі та канали">
        <div className="grid grid-cols-1 gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <SalesVelocityMatrix velocity={data.salesVelocity} peakHours={data.peakHours} />
          <RefurbishmentWidget capital={data.refurbishmentCapital} margin={data.refurbishmentMargin} onClick={() => router.push("/admin/devices")} />
          <B2BPartnerShareWidget share={data.partnerVolumeShare} revenue={data.partnerRevenueTotal} />
          <CrossSellWidget conversionRate={data.crossSellConversionRate} revenue={data.crossSellRevenue30Days} dealsCount={data.crossSellDealsCount} />
        </div>
      </Section>

      <Section title="Склад — сигнали">
        <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-2">
          <StockoutIntelligenceWidget items={data.stockoutForecast} />
        </div>
      </Section>

      <Section title="Модельний ряд">
        <div className="grid grid-cols-1 gap-4 md:gap-5 md:grid-cols-3">
          <PhoneModelDemandWidget models={data.modelAnalytics} />
          <RevenueHeatmapWidget heatmap={data.revenueHeatmap} />
        </div>
      </Section>
    </div>
  );
}
