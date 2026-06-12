export default function ServicesLoading() {
  return (
    <div className="animate-pulse space-y-0">
      <div className="p-5">
        <div className="h-7 w-28 rounded-lg bg-warm-border/30" />
      </div>
      <div className="grid grid-cols-1 gap-0 md:grid-cols-3">
        <div className="h-24 rounded-xl bg-warm-border/30" />
        <div className="h-24 rounded-xl bg-warm-border/30" />
        <div className="h-24 rounded-xl bg-warm-border/30" />
      </div>
      <div className="h-64 rounded-xl bg-warm-border/30 m-0" />
    </div>
  );
}
