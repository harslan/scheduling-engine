"use client";

import { approveEvent, denyEvent } from "@/lib/actions/events";
import { CheckCircle, XCircle, MessageSquare } from "lucide-react";
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
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");

  async function handleApprove() {
    setLoading("approve");
    const result = await approveEvent(eventId, orgSlug, comment || undefined);
    if (result.success) {
      setDone("approved");
    }
    setLoading(null);
  }

  async function handleDeny() {
    setLoading("deny");
    const result = await denyEvent(eventId, orgSlug, comment || undefined);
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
    <div className="shrink-0 space-y-2">
      <div className="flex items-center gap-2">
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
        <button
          onClick={() => setShowComment(!showComment)}
          className={`p-1.5 rounded-lg text-sm transition-colors ${
            showComment
              ? "bg-primary/10 text-primary"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          }`}
          title="Add comment"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
      </div>
      {showComment && (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment (optional)..."
          rows={2}
          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none resize-none"
        />
      )}
    </div>
  );
}
