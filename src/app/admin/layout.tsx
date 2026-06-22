import AdminSidebar from "@/components/AdminSidebar";
import MobileNavigation from "@/components/layout/MobileNavigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row pt-14 md:pt-0 pb-20 md:pb-0">
      <AdminSidebar />
      <main className="flex-1 p-4 md:p-6 w-full max-w-[100vw] overflow-x-hidden">{children}</main>
      <MobileNavigation />
    </div>
  );
}
