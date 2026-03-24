"use client";

import { deleteEvent } from "@/lib/actions/events";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteEventButton({
  eventId,
  orgSlug,
}: {
  eventId: string;
  orgSlug: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    await deleteEvent(eventId, orgSlug);
    router.push(`/${orgSlug}/my-events`);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Cancel this event?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Yes, Cancel"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
      Cancel Event
    </button>
  );
}
