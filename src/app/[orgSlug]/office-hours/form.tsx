"use client";

import { saveOfficeHours } from "@/lib/actions/office-hours";
import { useState } from "react";
import { CheckCircle, ArrowRight, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";

const DAYS = [
  { token: "", label: "—" },
  { token: "M", label: "Mon" },
  { token: "T", label: "Tue" },
  { token: "W", label: "Wed" },
  { token: "TH", label: "Thu" },
  { token: "F", label: "Fri" },
] as const;

interface Row {
  day: string;
  start: string;
  end: string;
  room: string;
  mode: string;
}

const emptyRow: Row = { day: "", start: "", end: "", room: "", mode: "in-person" };

export function OfficeHoursForm({
  organizationId,
  orgSlug,
  semester,
  defaultRoom,
  initialPublish,
  initialLive,
  initialNote,
  initialBlocks,
}: {
  organizationId: string;
  orgSlug: string;
  semester: string;
  defaultRoom: string;
  initialPublish: boolean;
  initialLive: boolean;
  initialNote: string;
  initialBlocks: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(
    initialBlocks.length ? initialBlocks : [emptyRow],
  );
  const [publish, setPublish] = useState(initialPublish);
  const [live, setLive] = useState(initialLive);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { ...emptyRow }]);
  const removeRow = (i: number) =>
    setRows((rs) => (rs.length === 1 ? [{ ...emptyRow }] : rs.filter((_, j) => j !== i)));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    // only rows the faculty actually filled — a blank row means nothing
    const blocks = rows
      .filter((r) => r.day && r.start && r.end)
      .map((r) => ({
        day: r.day,
        start: r.start,
        end: r.end,
        roomSlug: (r.room || defaultRoom).trim(),
        mode: r.mode,
      }));
    const fd = new FormData(e.currentTarget);
    fd.set("organizationId", organizationId);
    fd.set("semester", semester);
    fd.set("blocksJson", JSON.stringify(blocks));
    if (publish) fd.set("publish", "on");
    else fd.delete("publish");
    if (live) fd.set("live", "on");
    else fd.delete("live");

    const result = await saveOfficeHours(fd);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
        <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Office hours saved</h2>
        <p className="text-slate-500 mb-6">
          {publish
            ? "Students can find you now — revise any time."
            : "Saved, but hidden: turn on “publish” whenever you’re ready to appear."}
        </p>
        <Link
          href={`/find/${orgSlug}`}
          className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          See the student map <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900 mb-1">When you&rsquo;re in</p>
        <p className="text-xs text-slate-500 mb-4">
          Add the blocks you hold. Leave a row off entirely — blank means nothing, not
          &ldquo;unknown.&rdquo;
        </p>

        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <select
                value={r.day}
                onChange={(e) => update(i, { day: e.target.value })}
                aria-label="Day"
                className="px-2 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:border-primary outline-none"
              >
                {DAYS.map((d) => (
                  <option key={d.token} value={d.token}>
                    {d.label}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={r.start}
                onChange={(e) => update(i, { start: e.target.value })}
                aria-label="Start"
                className="px-2 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:border-primary outline-none"
              />
              <span className="text-slate-400 text-sm">to</span>
              <input
                type="time"
                value={r.end}
                onChange={(e) => update(i, { end: e.target.value })}
                aria-label="End"
                className="px-2 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:border-primary outline-none"
              />
              <input
                type="text"
                value={r.room}
                onChange={(e) => update(i, { room: e.target.value })}
                placeholder={defaultRoom || "room"}
                aria-label="Room"
                className="flex-1 min-w-[90px] px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:border-primary outline-none"
              />
              <select
                value={r.mode}
                onChange={(e) => update(i, { mode: e.target.value })}
                aria-label="Mode"
                className="px-2 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:border-primary outline-none"
              >
                <option value="in-person">in person</option>
                <option value="virtual">virtual</option>
              </select>
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label="Remove block"
                className="text-slate-400 hover:text-red-500 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
        >
          <Plus className="w-4 h-4" /> Add a block
        </button>

        <p className="mt-3 text-xs text-slate-400">
          Room defaults to your assigned office{defaultRoom ? ` (${defaultRoom})` : ""}. For a
          virtual block, put a link or &ldquo;online&rdquo; in the room field — virtual hours
          serve students but occupy no office.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <label htmlFor="note" className="text-sm font-semibold text-slate-900 block mb-1">
          A note to students <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="note"
          name="note"
          type="text"
          maxLength={300}
          defaultValue={initialNote}
          placeholder="Walk-ins welcome — or email me to hold a slot."
          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-slate-900">Two dials, both yours</p>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Publish these to the student map
            <span className="block text-xs text-slate-400">
              Off, and you vanish from search entirely.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Also show &ldquo;I&rsquo;m in right now&rdquo; with the room, live
            <span className="block text-xs text-slate-400">
              Off by default. When off, students see your schedule but never your live
              location.
            </span>
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save my office hours</>}
      </button>
    </form>
  );
}
