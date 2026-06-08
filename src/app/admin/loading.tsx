export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded-xl bg-glass border border-glass-border" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="col-span-2 h-32 rounded-2xl bg-glass border border-glass-border" />
        <div className="h-32 rounded-2xl bg-glass border border-glass-border" />
        <div className="h-32 rounded-2xl bg-glass border border-glass-border" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="col-span-3 h-64 rounded-2xl bg-glass border border-glass-border" />
        <div className="h-64 rounded-2xl bg-glass border border-glass-border" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="h-40 rounded-2xl bg-glass border border-glass-border" />
        <div className="h-40 rounded-2xl bg-glass border border-glass-border" />
        <div className="h-40 rounded-2xl bg-glass border border-glass-border" />
      </div>
    </div>
  );
}
