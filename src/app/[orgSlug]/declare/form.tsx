"use client";

import { saveDeclaration } from "@/lib/actions/declarations";
import { useState } from "react";
import { CheckCircle, ArrowRight, Loader2, Heart } from "lucide-react";
import Link from "next/link";

const DAYS = [
  { token: "M", label: "Mon" },
  { token: "T", label: "Tue" },
  { token: "W", label: "Wed" },
  { token: "TH", label: "Thu" },
  { token: "F", label: "Fri" },
] as const;

export function DeclareForm({
  organizationId,
  orgSlug,
  semester,
  thresholdDays,
  initialDays,
  initialPartner,
  initialWantsDedicated,
  initialNotes,
  colleagues,
  namedMeIds,
}: {
  organizationId: string;
  orgSlug: string;
  semester: string;
  thresholdDays: number;
  initialDays: string[];
  initialPartner: string;
  initialWantsDedicated: boolean;
  initialNotes: string;
  colleagues: { id: string; name: string }[];
  namedMeIds: string[];
}) {
  const [days, setDays] = useState<string[]>(initialDays);
  const [partner, setPartner] = useState(initialPartner);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggle = (t: string) =>
    setDays((d) => (d.includes(t) ? d.filter((x) => x !== t) : [...d, t]));

  // The tier HINT — clause 2.4 logic on declared days, shown so faculty see
  // what the rule does. The banner above makes the guarantee: this hint (and
  // this whole form) cannot change entitlement, which is measured.
  const weekdays = days.filter((d) => d !== "F");
  const isMW =
    ["M", "W"].every((d) => days.includes(d)) &&
    !days.some((d) => ["T", "TH"].includes(d));
  const isTTH =
    ["T", "TH"].every((d) => days.includes(d)) &&
    !days.some((d) => ["M", "W"].includes(d));
  const hint =
    weekdays.length >= thresholdDays
      ? `${weekdays.length} weekdays → a dedicated office (threshold is ${thresholdDays})`
      : isMW || isTTH
        ? `${isMW ? "Mon/Wed" : "Tue/Thu"} pattern → a shared office with a complementary colleague`
        : days.length === 0
          ? "No days yet — tap the days you expect to be on campus"
          : `${days.length} day${days.length > 1 ? "s" : ""} → a guaranteed pool seat, same room all semester`;

  const mutual = partner && namedMeIds.includes(partner);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    formData.set("organizationId", organizationId);
    formData.set("semester", semester);
    formData.set("days", days.join(","));
    const result = await saveDeclaration(formData);
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
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Declaration saved
        </h2>
        <p className="text-slate-500 mb-6">
          You can revise it any time until the declaration window closes.
          Nothing is assigned until the rule is settled and run.
        </p>
        <Link
          href={`/${orgSlug}`}
          className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          Back to Calendar <ArrowRight className="w-4 h-4" />
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
        <p className="text-sm font-semibold text-slate-900 mb-1">
          Days you expect to be on campus
        </p>
        <p className="text-xs text-slate-500 mb-4">
          Fridays the floor runs open — no holds, no bookings needed.
        </p>
        <div className="grid grid-cols-5 gap-2">
          {DAYS.map((d) => {
            const on = days.includes(d.token);
            const fri = d.token === "F";
            return (
              <button
                key={d.token}
                type="button"
                onClick={() => toggle(d.token)}
                aria-pressed={on}
                className={`py-3 rounded-lg border text-sm font-semibold transition-colors ${
                  on
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : fri
                      ? "bg-[repeating-linear-gradient(45deg,#fff_0_5px,#f1f5f9_5px_10px)] border-slate-200 text-slate-400"
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          {hint}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          A hint, not a promise: your tier is set by your measured teaching
          schedule, so changing this form changes nothing about what you&apos;re
          owed.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <label
          htmlFor="partnerPrefUserId"
          className="text-sm font-semibold text-slate-900 block mb-1"
        >
          Preferred office partner{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <p className="text-xs text-slate-500 mb-3">
          Named pairs are matched first — but only if you name each other.
          Otherwise the engine proposes a stable match you can still swap out of.
        </p>
        <select
          id="partnerPrefUserId"
          name="partnerPrefUserId"
          value={partner}
          onChange={(e) => setPartner(e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
        >
          <option value="">No preference — match me fairly</option>
          {colleagues.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {namedMeIds.includes(c.id) ? " — named you" : ""}
            </option>
          ))}
        </select>
        {mutual && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
            <Heart className="w-3.5 h-3.5" /> Mutual — you named each other, so
            you&apos;ll be paired first.
          </p>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="wantsDedicated"
            defaultChecked={initialWantsDedicated}
            className="mt-0.5"
          />
          <span>
            I expect to be on campus enough to want a dedicated office
            <span className="block text-xs text-slate-400">
              Registers interest only — the threshold itself is measured.
            </span>
          </span>
        </label>
        <div>
          <label
            htmlFor="notes"
            className="text-sm font-semibold text-slate-900 block mb-1"
          >
            Anything the allocation should know?{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            maxLength={500}
            defaultValue={initialNotes}
            placeholder="Accessibility needs, adjacency requests, storage…"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>Save my declaration</>
        )}
      </button>
    </form>
  );
}
