export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-48 rounded-xl bg-warm-border/30 animate-pulse" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {[1,2,3].map(i => <div key={i} className="card p-5"><div className="h-16 rounded-xl bg-warm-border/20 animate-pulse" /></div>)}
      </div>
      <div className="card p-5">
        <div className="h-64 rounded-xl bg-warm-border/20 animate-pulse" />
      </div>
    </div>
  );
}
