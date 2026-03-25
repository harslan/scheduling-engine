"use client";

import { adminUpdateEventStatus } from "@/lib/actions/events";
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

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as "APPROVED" | "PENDING" | "DENIED" | "CANCELLED";
    if (newStatus === currentStatus) return;
    if (!confirm(`Change status to ${newStatus}?`)) {
      e.target.value = currentStatus;
      return;
    }

    setLoading(true);
    await adminUpdateEventStatus(eventId, orgSlug, newStatus);
    setLoading(false);
  }

  return (
    <select
      defaultValue={currentStatus}
      onChange={handleChange}
      disabled={loading}
      className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none disabled:opacity-50"
    >
      <option value="PENDING">Pending</option>
      <option value="APPROVED">Approved</option>
      <option value="DENIED">Denied</option>
      <option value="CANCELLED">Cancelled</option>
    </select>
  );
}
