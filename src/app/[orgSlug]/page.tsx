import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const today = new Date();
  const monthName = today.toLocaleString("default", { month: "long" });
  const year = today.getFullYear();

  // Generate calendar grid for current month
  const firstDay = new Date(year, today.getMonth(), 1);
  const lastDay = new Date(year, today.getMonth() + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const days = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      {/* Calendar header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {monthName} {year}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {orgSlug} &mdash; Calendar View
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <button className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Today
          </button>
          <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          <div className="ml-4 flex rounded-lg border border-slate-200 overflow-hidden">
            {["Month", "Week", "Day"].map((view) => (
              <button
                key={view}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === "Month"
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {weekDays.map((day) => (
            <div
              key={day}
              className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-center bg-slate-50"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => (
            <div
              key={i}
              className={`min-h-28 border-b border-r border-slate-100 p-2 ${
                day === null ? "bg-slate-50/50" : "hover:bg-slate-50/50"
              } ${day === today.getDate() ? "bg-primary/5" : ""}`}
            >
              {day !== null && (
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm ${
                    day === today.getDate()
                      ? "bg-primary text-white font-bold"
                      : "text-slate-700"
                  }`}
                >
                  {day}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
