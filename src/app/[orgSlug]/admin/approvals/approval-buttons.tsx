"use client";

import { approveEvent, denyEvent } from "@/lib/actions/events";
import { CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";

export function ApprovalButtons({
  eventId,
  orgSlug,
}: {
  eventId: string;
  orgSlug: string;
}) {
  const [loading, setLoading] = useState<"approve" | "deny" | null>(null);
  const [done, setDone] = useState<"approved" | "denied" | null>(null);

  async function handleApprove() {
    setLoading("approve");
    const result = await approveEvent(eventId, orgSlug);
    if (result.success) {
      setDone("approved");
    }
    setLoading(null);
  }

  async function handleDeny() {
    setLoading("deny");
    const result = await denyEvent(eventId, orgSlug);
    if (result.success) {
      setDone("denied");
    }
    setLoading(null);
  }

  if (done === "approved") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
        <CheckCircle className="w-4 h-4" /> Approved
      </span>
    );
  }

  if (done === "denied") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-red-600">
        <XCircle className="w-4 h-4" /> Denied
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={handleApprove}
        disabled={loading !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50"
      >
        <CheckCircle className="w-3.5 h-3.5" />
        {loading === "approve" ? "..." : "Approve"}
      </button>
      <button
        onClick={handleDeny}
        disabled={loading !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
      >
        <XCircle className="w-3.5 h-3.5" />
        {loading === "deny" ? "..." : "Deny"}
      </button>
    </div>
  );
}
