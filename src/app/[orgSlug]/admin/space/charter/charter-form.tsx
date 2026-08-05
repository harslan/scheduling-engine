"use client";

import { updateCharterAction, ratifyCharterAction } from "@/lib/actions/charter";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all text-sm";

export function CharterForm({
  organizationId,
  charter,
}: {
  organizationId: string;
  charter: {
    thresholdDays: number;
    reservedOffices: number;
    slackFraction: number | null;
    adjunctsInScope: boolean | null;
    minSf: number;
    privateRoomSlugs: string;
    ratified: boolean;
  };
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("organizationId", organizationId);
    const r = await updateCharterAction(fd);
    setLoading(false);
    if ("error" in r && r.error) setMsg({ ok: false, text: r.error });
    else {
      const changed = "changed" in r ? r.changed : 0;
      setMsg({
        ok: true,
        text:
          changed === 0
            ? "No changes."
            : `${changed} change(s) recorded in the log.`,
      });
      router.refresh();
    }
  }

  async function ratify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("organizationId", organizationId);
    const r = await ratifyCharterAction(fd);
    setLoading(false);
    if (r.error) setMsg({ ok: false, text: r.error });
    else {
      setMsg({ ok: true, text: "Ratified. Future runs are OFFICIAL." });
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`text-sm rounded-lg px-4 py-3 border ${
            msg.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      <form
        onSubmit={submit}
        className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4"
      >
        <h2 className="text-sm font-bold text-slate-900">The dials</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <label className="block">
            <span className="text-slate-600">Dedicated threshold (days) — 2.4</span>
            <input name="thresholdDays" type="number" min={1} max={5}
              defaultValue={charter.thresholdDays} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-slate-600">Reserved offices — 6.2</span>
            <input name="reservedOffices" type="number" min={0}
              defaultValue={charter.reservedOffices} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-slate-600">Slack reserve (0–1, blank = UNDECIDED)</span>
            <input name="slackFraction" type="number" step="0.05" min={0} max={0.5}
              defaultValue={charter.slackFraction ?? ""} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-slate-600">Adjuncts in the pool?</span>
            <select
              name="adjunctsInScope"
              defaultValue={
                charter.adjunctsInScope === null
                  ? "undecided"
                  : String(charter.adjunctsInScope)
              }
              className={inputCls}
            >
              <option value="undecided">UNDECIDED</option>
              <option value="true">Yes — pool offices</option>
              <option value="false">No — bookable rooms</option>
            </select>
          </label>
          <label className="block">
            <span className="text-slate-600">Standard office minimum (sf) — 6.1</span>
            <input name="minSf" type="number" min={0}
              defaultValue={charter.minSf} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-slate-600">Private room slugs — 7.2 (never allocated)</span>
            <input name="privateRoomSlugs"
              defaultValue={charter.privateRoomSlugs} className={inputCls} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-slate-600 font-semibold">
            Reason for this change (required — goes to the log)
          </span>
          <textarea name="reason" rows={2} className={inputCls}
            placeholder="Why is this dial moving? A quiet edit is not an amendment (10.2)." />
        </label>
        <button
          disabled={loading}
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Save with reason
        </button>
      </form>

      {!charter.ratified && (
        <form
          onSubmit={ratify}
          className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3"
        >
          <h2 className="text-sm font-bold text-amber-900">
            Ratification — charter 10.4
          </h2>
          <p className="text-xs text-amber-800">
            Point at a real decision: the body that voted and the record of the
            vote. After this, every run becomes OFFICIAL. A commit is not a
            decision.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <input name="ratifiedBy" placeholder="Body that voted (e.g. SBS Faculty Assembly)"
              className={inputCls} />
            <input name="ratificationRecord" placeholder="Record (minutes link / reference)"
              className={inputCls} />
          </div>
          <button
            disabled={loading}
            className="inline-flex items-center gap-2 bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-800 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Ratify
          </button>
        </form>
      )}
    </div>
  );
}
