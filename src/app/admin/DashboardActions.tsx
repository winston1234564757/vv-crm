import { AddSaleButton } from "./AddSaleButton";
import { AddRepairButton } from "./repairs/AddRepairButton";
import { AddOrderButton } from "./AddOrderButton";
import { IconPlus } from "@/components/icons";

/**
 * Три дії шапки дашборду.
 *
 * На телефоні вони стояли трьома кнопками на всю ширину і з'їдали двісті
 * пікселів до першого корисного числа — найважливіше на екрані опинялось за
 * згином заради дій, які роблять кілька разів на день.
 *
 * Тепер це один ряд плюс другий: продаж окремо (найчастіша дія в магазині),
 * ремонт і замовлення поруч. Не три рівні кнопки в ряд — «Замовлення» з
 * іконкою це ~126px, а третина екрана 390px дає 114, тож підпис різало б.
 * Два ряди замість трьох економлять ті самі сто пікселів без обрізань.
 *
 * Класи тут лише про розкладку: форму, стани й фокус дає примітив `Button`
 * (`AddSaleButton` — посилання, тому повторює його вигляд явно).
 */

const linkAsButton =
  "btn-press inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] " +
  "bg-accent px-4 text-sm font-medium whitespace-nowrap text-on-accent transition-colors " +
  "duration-150 hover:bg-accent-hover active:bg-accent-active " +
  "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

export function DashboardActions() {
  return (
    <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
      <AddSaleButton className={`${linkAsButton} w-full md:w-auto`}>
        <IconPlus />
        Новий продаж
      </AddSaleButton>

      <div className="flex items-center gap-2">
        <AddRepairButton variant="secondary" className="flex-1 md:flex-none">
          Прийняти в ремонт
        </AddRepairButton>
        <AddOrderButton variant="secondary" className="flex-1 md:flex-none">
          Замовлення
        </AddOrderButton>
      </div>
    </div>
  );
}
