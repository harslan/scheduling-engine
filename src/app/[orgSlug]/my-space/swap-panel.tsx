"use client";

import { proposeSwapAction, actOnSwapAction } from "@/lib/actions/swaps";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, ArrowLeftRight } from "lucide-react";

export function SwapPanel({
  organizationId,
  semester,
  options,
  incoming,
  outgoing,
}: {
  organizationId: string;
  semester: string;
  options: { userId: string; label: string }[];
  incoming: { id: string; label: string; progress: string }[];
  outgoing: { id: string; label: string; status: string }[];
}) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function propose() {
    if (!target) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("organizationId", organizationId);
    fd.set("semester", semester);
    fd.set("targetUserId", target);
    const r = await proposeSwapAction(fd);
    setBusy(false);
    if ("error" in r && r.error) setMsg({ ok: false, text: r.error });
    else {
      setMsg({
        ok: true,
        text: "Proposed — it applies only when everyone sharing the affected offices consents.",
      });
      router.refresh();
    }
  }

  async function act(swapId: string, decision: "consent" | "decline") {
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("organizationId", organizationId);
    fd.set("swapId", swapId);
    fd.set("decision", decision);
    const r = await actOnSwapAction(fd);
    setBusy(false);
    if ("error" in r && r.error) setMsg({ ok: false, text: r.error });
    else router.refresh();
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <ArrowLeftRight className="w-4 h-4" /> Swap by consent — charter 5.3
      </h2>
      {msg && (
        <p
          className={`text-sm rounded-lg px-3 py-2 border ${
            msg.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {msg.text}
        </p>
      )}
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="flex-1 min-w-52 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm"
        >
          <option value="">Choose a colleague to trade with…</option>
          {options.map((o) => (
            <option key={o.userId} value={o.userId}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={propose}
          disabled={busy || !target}
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Propose swap
        </button>
      </div>
      <p className="text-xs text-slate-400">
        No one&apos;s officemate changes without their agreement — everyone
        sharing either office must consent, and any decline ends it.
      </p>

      {incoming.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
            Awaiting your consent
          </h3>
          <ul className="space-y-2">
            {incoming.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 text-sm border border-slate-200 rounded-lg px-3 py-2"
              >
                <span>
                  {s.label}{" "}
                  <span className="text-xs text-slate-400">({s.progress})</span>
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => act(s.id, "consent")}
                    disabled={busy}
                    className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                  >
                    Consent
                  </button>
                  <button
                    onClick={() => act(s.id, "decline")}
                    disabled={busy}
                    className="border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium"
                  >
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {outgoing.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
            Your proposals
          </h3>
          <ul className="space-y-1 text-sm text-slate-600">
            {outgoing.map((s) => (
              <li key={s.id}>
                {s.label} —{" "}
                <span
                  className={
                    s.status === "accepted"
                      ? "text-emerald-700 font-semibold"
                      : s.status === "declined"
                        ? "text-slate-400"
                        : "text-amber-700 font-semibold"
                  }
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
