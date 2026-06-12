export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="p-5">
        <div className="h-7 w-36 rounded-lg bg-warm-border/30" />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <div className="h-32 rounded-xl bg-iris/10 md:col-span-2"></div>
        <div className="h-32 rounded-xl bg-iris/10"></div>
        <div className="h-32 rounded-xl bg-iris/10"></div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <div className="h-64 rounded-xl bg-iris/10 md:col-span-3"></div>
        <div className="h-64 rounded-xl bg-iris/10"></div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="h-40 rounded-xl bg-warm-border/30" />
        <div className="h-40 rounded-xl bg-warm-border/30" />
        <div className="h-40 rounded-xl bg-warm-border/30" />
      </div>
    </div>
  );
}
