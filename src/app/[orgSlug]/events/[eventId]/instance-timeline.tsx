"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, MoreVertical, Loader2, AlertCircle, XCircle, FastForward, Pencil } from "lucide-react";
import {
  deleteInstance,
  deleteAllFutureInstances,
  endSeriesNow,
  updateInstance,
} from "@/lib/actions/instance-actions";

interface Instance {
  id: string;
  startDateTime: string;
  endDateTime: string;
  deleted: boolean;
}

interface InstanceTimelineProps {
  instances: Instance[];
  eventId: string;
  orgSlug: string;
  canEdit: boolean;
  isRecurring: boolean;
}

function formatInstanceDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatInstanceTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Convert ISO string to datetime-local input value */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function InstanceTimeline({
  instances,
  eventId,
  orgSlug,
  canEdit,
  isRecurring,
}: InstanceTimelineProps) {
  if (!isRecurring || instances.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-500">
          Instances ({instances.length})
        </p>
        {canEdit && <EndSeriesButton eventId={eventId} orgSlug={orgSlug} />}
      </div>
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {instances.map((inst) => (
          <InstanceRow
            key={inst.id}
            instance={inst}
            eventId={eventId}
            orgSlug={orgSlug}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Instance Row
// ============================================================

function InstanceRow({
  instance,
  eventId,
  orgSlug,
  canEdit,
}: {
  instance: Instance;
  eventId: string;
  orgSlug: string;
  canEdit: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"delete" | "deleteFuture" | null>(null);
  const [editing, setEditing] = useState(false);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  function handleAction(action: "delete" | "deleteFuture") {
    setError("");
    startTransition(async () => {
      const result =
        action === "delete"
          ? await deleteInstance(instance.id, orgSlug)
          : await deleteAllFutureInstances(instance.id, orgSlug);

      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setConfirmAction(null);
        setMenuOpen(false);
        router.refresh();
      }
    });
  }

  function openEditor() {
    setEditStart(toLocalInput(instance.startDateTime));
    setEditEnd(toLocalInput(instance.endDateTime));
    setEditing(true);
    setMenuOpen(false);
    setError("");
  }

  function handleSaveTime() {
    setError("");
    startTransition(async () => {
      const result = await updateInstance(instance.id, orgSlug, {
        startDateTime: new Date(editStart).toISOString(),
        endDateTime: new Date(editEnd).toISOString(),
      });

      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="group relative">
      <div className="flex items-center gap-2 text-sm text-slate-600 py-1">
        <Clock className="w-3 h-3 text-slate-300 shrink-0" />
        <span className="flex-1">
          {formatInstanceDate(instance.startDateTime)} at{" "}
          {formatInstanceTime(instance.startDateTime)} –{" "}
          {formatInstanceTime(instance.endDateTime)}
        </span>

        {canEdit && !confirmAction && !editing && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              aria-label="Instance actions"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[200px]">
                  <button
                    onClick={openEditor}
                    className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Pencil className="w-3.5 h-3.5 text-primary" />
                    Change time
                  </button>
                  <button
                    onClick={() => {
                      setConfirmAction("delete");
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                    Cancel this instance
                  </button>
                  <button
                    onClick={() => {
                      setConfirmAction("deleteFuture");
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FastForward className="w-3.5 h-3.5 text-red-500" />
                    Cancel this &amp; all future
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Inline time editor */}
      {editing && (
        <div className="pl-5 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={editStart}
              onChange={(e) => setEditStart(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded text-xs bg-slate-50 focus:border-primary focus:ring-1 focus:ring-primary/10 outline-none"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="datetime-local"
              value={editEnd}
              onChange={(e) => setEditEnd(e.target.value)}
              className="px-2 py-1 border border-slate-200 rounded text-xs bg-slate-50 focus:border-primary focus:ring-1 focus:ring-primary/10 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveTime}
              disabled={isPending || !editStart || !editEnd}
              className="flex items-center gap-1 px-2 py-0.5 bg-primary text-white text-xs font-medium rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              {isPending ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setError("");
              }}
              disabled={isPending}
              className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirm bar */}
      {confirmAction && (
        <div className="flex items-center gap-2 py-1 pl-5">
          <span className="text-xs text-slate-500">
            {confirmAction === "delete"
              ? "Cancel this instance?"
              : "Cancel this and all future instances?"}
          </span>
          <button
            onClick={() => handleAction(confirmAction)}
            disabled={isPending}
            className="flex items-center gap-1 px-2 py-0.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            {isPending ? "Cancelling..." : "Yes"}
          </button>
          <button
            onClick={() => {
              setConfirmAction(null);
              setError("");
            }}
            disabled={isPending}
            className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            No
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 pl-5 py-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

// ============================================================
// End Series Button
// ============================================================

function EndSeriesButton({
  eventId,
  orgSlug,
}: {
  eventId: string;
  orgSlug: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  function handleEndSeries() {
    setError("");
    startTransition(async () => {
      const result = await endSeriesNow(eventId, orgSlug);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setConfirming(false);
        router.refresh();
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">End series now?</span>
          <button
            onClick={handleEndSeries}
            disabled={isPending}
            className="flex items-center gap-1 px-2 py-0.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            {isPending ? "Ending..." : "Yes"}
          </button>
          <button
            onClick={() => {
              setConfirming(false);
              setError("");
            }}
            disabled={isPending}
            className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            No
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
    >
      End series now
    </button>
  );
}
