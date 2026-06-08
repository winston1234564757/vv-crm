export default function AdminLoading() {
  return (
    <div className="animate-pulse p-6">
      <div className="mb-6">
        <div className="h-8 w-48 rounded-sm bg-worn" />
        <div className="mt-2 h-4 w-36 rounded-sm bg-worn/50" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-sm bg-cork bench-edge" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="col-span-2 h-72 rounded-sm bg-cork bench-edge" />
        <div className="h-72 rounded-sm bg-cork bench-edge" />
        <div className="h-56 rounded-sm bg-cork bench-edge" />
        <div className="h-56 rounded-sm bg-cork bench-edge" />
      </div>
    </div>
  );
}
