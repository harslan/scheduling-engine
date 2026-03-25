"use client";

import { adminUpdateEventStatus } from "@/lib/actions/events";
import { Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";

export function AdminStatusDropdown({
  eventId,
  orgSlug,
  currentStatus,
}: {
  eventId: string;
  orgSlug: string;
  currentStatus: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as "APPROVED" | "PENDING" | "DENIED" | "CANCELLED";
    if (newStatus === currentStatus) return;
    setPendingStatus(newStatus);
  }

  async function confirmChange() {
    if (!pendingStatus) return;
    setLoading(true);
    setError("");
    try {
      const result = await adminUpdateEventStatus(
        eventId,
        orgSlug,
        pendingStatus as "APPROVED" | "PENDING" | "DENIED" | "CANCELLED"
      );
      if (result?.error) {
        setError(result.error);
      }
    } catch {
      setError("Failed to update status");
    }
    setLoading(false);
    setPendingStatus(null);
  }

  function cancelChange() {
    setPendingStatus(null);
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <select
          defaultValue={currentStatus}
          onChange={handleChange}
          disabled={loading || pendingStatus !== null}
          className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none disabled:opacity-50"
        >
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="DENIED">Denied</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
      </div>
      {pendingStatus && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500">
            Change to <span className="font-medium">{pendingStatus}</span>?
          </span>
          <button
            onClick={confirmChange}
            className="px-2 py-0.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary-dark transition-colors"
          >
            Yes
          </button>
          <button
            onClick={cancelChange}
            className="px-2 py-0.5 text-slate-500 hover:text-slate-700 transition-colors"
          >
            No
          </button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
