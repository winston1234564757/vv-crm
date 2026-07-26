import { PageHeader } from "@/components/layout/PageHeader";
import { CurrentTime } from "@/components/CurrentTime";
import { BentoCell } from "@/components/ui/BentoCell";
import { DashboardActions } from "./DashboardActions";
import { RangeTabs } from "./RangeTabs";
import { HeroToday } from "./HeroToday";
import { RepairQueueCard } from "./RepairQueueCard";
import { TodaySalesCard } from "./TodaySalesCard";
import { PickupCard } from "./PickupCard";
import { OrdersCard } from "./OrdersCard";
import { MoneyBreakdownCard } from "./MoneyBreakdownCard";
import { CashCard } from "./CashCard";
import { ShareCard } from "./ShareCard";
import { AttentionSection } from "./AttentionSection";
import { InsightsSection } from "./InsightsSection";
import type { AttentionGroup } from "@/lib/attention";
import type { DashboardMoney } from "@/lib/data-dashboard";
import type { OperationsData } from "@/lib/data-operations";
import type { SalesTargets } from "@/lib/data-settings";
import type { RangePreset } from "@/lib/profit";
import { dayLabel } from "@/lib/utils/day";

interface DashboardClientProps {
  preset: RangePreset;
  selectedDay: string | null;
  attention: AttentionGroup[];
  money: DashboardMoney;
  operations: OperationsData;
  targets: SalesTargets;
}

/**
 * Бенто-сітка дашборду (DESIGN.md §4.1): 12 колонок на `lg`, 6 на `md`, один
 * стовпчик нижче. Асиметрія несе ієрархію — інвертований hero на дві третини
 * ширини тримає око, черга ремонтів стоїть поруч вузькою колонкою.
 *
 * Компонент серверний, попри історичну назву. Клієнтського тут лишилось
 * рівно те, що справді інтерактивне: `RangeTabs`, драєри в `AttentionSection`,
 * `InsightsSection`, кнопки додавання й зняття частки. `findAttention`
 * переїхав на сервер, у `page.tsx`.
 *
 * Порядок у DOM — це і є порядок на мобілці: спершу гроші дня, далі робота,
 * потім розклад і аналіз.
 *
 * Ряди складаються по 12: hero+черга · три операційні · розклад+каса ·
 * частка+увага. Спани статичні (`BentoCell`), тож будь-яка зміна цього
 * набору вимагає перерахувати ряд руками — сітка сама дірку не закриє.
 */
export function DashboardClient({
  preset,
  selectedDay,
  attention,
  money,
  operations,
  targets,
}: DashboardClientProps) {
  const today = new Date().toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Панель керування"
        subtitle={
          <span className="flex items-center gap-1 capitalize">
            {today}
            <CurrentTime />
          </span>
        }
        actions={<DashboardActions />}
      />

      <RangeTabs preset={preset} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
        <HeroToday
          preset={preset}
          profit={money.profit}
          comparison={money.comparison}
          series={money.series}
          dayLabel={selectedDay ? dayLabel(selectedDay) : "Сьогодні"}
        />

        <RepairQueueCard queue={operations.queue} total={operations.queueTotal} />

        <TodaySalesCard today={money.todaySales} />
        <PickupCard
          rows={operations.pickup.rows}
          total={operations.pickup.total}
          debt={operations.pickup.debt}
        />
        <OrdersCard
          rows={operations.orders.rows}
          total={operations.orders.total}
          arrived={operations.orders.arrived}
          ready={operations.orders.ready}
          overdue={operations.orders.overdue}
        />

        <MoneyBreakdownCard preset={preset} money={money} targets={targets} />
        <CashCard
          cashTotal={money.cashTotal}
          runwayDays={money.runwayDays}
          dailyOpex={money.dailyOpex}
        />

        {/*
          Частка йде перед увагою, а не після: увага рендериться лише коли їй
          є що сказати, і при тихому магазині картка частки має лишитись у
          своєму ряду зліва, а не поїхати в порожній рядок сама.
        */}
        <ShareCard
          ledger={money.partnerLedger}
          sources={money.sources}
          monthShare={money.partnerShare.month.share}
        />

        {attention.length > 0 && (
          <BentoCell span={8} title="Потребує уваги">
            <AttentionSection groups={attention} />
          </BentoCell>
        )}
      </div>

      <InsightsSection preset={preset} />
    </div>
  );
}
