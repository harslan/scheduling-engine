export default function Loading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-7 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-36 bg-slate-100 rounded animate-pulse mt-2" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-56 bg-slate-100 rounded animate-pulse" />
                  <div className="h-5 w-20 bg-slate-100 rounded-full animate-pulse" />
                </div>
                <div className="h-4 w-72 bg-slate-50 rounded animate-pulse" />
                <div className="h-3 w-40 bg-slate-50 rounded animate-pulse" />
              </div>
              <div className="h-9 w-24 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
