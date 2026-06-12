import AdminSidebar from "@/components/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-6 pt-20 md:pt-6">{children}</main>
    </div>
  );
}
