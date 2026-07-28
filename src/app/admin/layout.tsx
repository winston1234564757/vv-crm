import AdminSidebar from "@/components/AdminSidebar";
import MobileNavigation from "@/components/layout/MobileNavigation";
import SectionTabs from "@/components/layout/SectionTabs";
import { getCurrentUserRole } from "@/lib/utils/rbac";

/**
 * Роль читається тут один раз на сервері й роздається трьом споживачам
 * навігації. Раніше сайдбар і мобільне меню тягнули її окремими запитами з
 * браузера, а вкладки розділу не знали про неї взагалі — тому обмежений пункт
 * або блимав до приходу відповіді, або не ховався зовсім.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentUserRole();
  const role = session?.role ?? null;

  return (
    <div className="flex min-h-screen flex-col md:flex-row pt-14 md:pt-0 pb-20 md:pb-0">
      <AdminSidebar role={role} />
      <main className="flex-1 p-4 md:p-6 w-full max-w-[100vw] overflow-x-hidden">
        <SectionTabs role={role} />
        {children}
      </main>
      <MobileNavigation role={role} />
    </div>
  );
}
