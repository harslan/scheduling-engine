export default function Loading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-56 bg-slate-100 rounded animate-pulse mt-2" />
        </div>
        <div className="h-9 w-32 bg-slate-200 rounded-lg animate-pulse" />
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="px-4 py-4 border-b border-slate-100 flex items-center gap-4"
          >
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-32 bg-slate-50 rounded animate-pulse" />
            </div>
            <div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
