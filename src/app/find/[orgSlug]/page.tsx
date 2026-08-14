"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Search, RefreshCw, MapPin } from "lucide-react";

const REFRESH_INTERVAL_MS = 60_000;

interface Block {
  day: string;
  start: string;
  end: string;
  room: string;
  mode: string;
}
interface Faculty {
  name: string;
  note: string;
  live: boolean;
  blocks: Block[];
  openNow: { room: string | null; end: string } | null;
  next: { day: string; start: string } | null;
}
interface FindData {
  org: { name: string; timezone: string };
  semester: string;
  nScope: number;
  nPublished: number;
  faculty: Faculty[];
}

const DAY_LABEL: Record<string, string> = {
  M: "Mon",
  T: "Tue",
  W: "Wed",
  TH: "Thu",
  F: "Fri",
};

export default function FindPage() {
  const params = useParams<{ orgSlug: string }>();
  const [data, setData] = useState<FindData | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    async function fetchData() {
      try {
        const res = await fetch(`/api/office-hours?org=${params.orgSlug}`);
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    timer = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [params.orgSlug]);

  const shown = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    return t ? data.faculty.filter((f) => f.name.toLowerCase().includes(t)) : data.faculty;
  }, [data, q]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-7 h-7 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Find your professor</h1>
        <p className="text-sm text-slate-500 mt-1">
          When they&rsquo;re in, and where. {data.semester}.
        </p>

        <div className="relative mt-5">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a name…"
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
          />
        </div>

        {data.faculty.length === 0 ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            No office hours have been published yet. This map fills itself as faculty
            declare — and it only ever shows what they chose to share.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {shown.map((f) => (
              <FacultyCard key={f.name} f={f} />
            ))}
            {shown.length === 0 && (
              <p className="text-sm text-slate-500 py-4">
                No professor by that name has published hours yet.
              </p>
            )}
          </div>
        )}

        <p className="mt-6 pt-4 border-t border-dashed border-slate-200 text-xs text-slate-500">
          Showing {data.nPublished} of {data.nScope} faculty — only those who chose to
          publish. Nothing on this page is guessed; each line is exactly what a professor
          told us.
        </p>
      </div>
    </div>
  );
}

function FacultyCard({ f }: { f: Faculty }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="text-lg font-bold text-slate-900">{f.name}</div>
        {f.openNow ? (
          f.openNow.room ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              In now — {f.openNow.room} until {f.openNow.end}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              In office hours now
            </span>
          )
        ) : f.next ? (
          <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
            Next: {DAY_LABEL[f.next.day] ?? f.next.day} {f.next.start}
          </span>
        ) : null}
      </div>

      <div className="mt-3 divide-y divide-slate-100">
        {f.blocks.map((b, i) => {
          const isNow =
            !!f.openNow &&
            b.end === f.openNow.end &&
            b.day === f.blocks.find((x) => x.end === f.openNow!.end)?.day;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 py-1.5 text-sm ${
                isNow ? "bg-emerald-50 -mx-2 px-2 rounded" : ""
              }`}
            >
              <span className="w-11 shrink-0 font-semibold text-slate-500">
                {DAY_LABEL[b.day] ?? b.day}
              </span>
              <span className="text-slate-700 tabular-nums">
                {b.start}–{b.end}
              </span>
              <span className="flex items-center gap-1 text-slate-500 ml-auto">
                {b.mode === "virtual" ? (
                  <>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-primary border border-slate-200 rounded px-1">
                      virtual
                    </span>
                    {b.room}
                  </>
                ) : (
                  <>
                    <MapPin className="w-3 h-3" />
                    {b.room || "—"}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {f.note && <p className="mt-2.5 text-sm text-slate-600">{f.note}</p>}
    </div>
  );
}
