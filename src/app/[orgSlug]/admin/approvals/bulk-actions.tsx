"use client";

import { useState, useTransition } from "react";
import { bulkApproveEvents, bulkDenyEvents } from "@/lib/actions/events";
import { CheckCircle, XCircle, Loader2, AlertCircle, Square, CheckSquare, MinusSquare } from "lucide-react";

interface Props {
  pendingEventIds: string[];
  orgSlug: string;
  children: React.ReactNode;
}

export function BulkApprovalBar({
  pendingEventIds,
  orgSlug,
  children,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const allSelected =
    pendingEventIds.length > 0 && pendingEventIds.every((id) => selected.has(id));
  const someSelected = pendingEventIds.some((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingEventIds));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleBulkApprove() {
    const ids = Array.from(selected);
    setResult(null);
    startTransition(async () => {
      const res = await bulkApproveEvents(ids, orgSlug);
      const succeeded = res.results.filter((r) => r.success).length;
      const failed = res.results.filter((r) => !r.success);
      if (failed.length === 0) {
        setResult({ type: "success", message: `${succeeded} event(s) approved.` });
      } else {
        setResult({
          type: "error",
          message: `${succeeded} approved, ${failed.length} failed: ${failed.map((f) => f.error).join("; ")}`,
        });
      }
      setSelected(new Set());
    });
  }

  function handleBulkDeny() {
    const ids = Array.from(selected);
    setResult(null);
    startTransition(async () => {
      const res = await bulkDenyEvents(ids, orgSlug);
      const succeeded = res.results.filter((r) => r.success).length;
      const failed = res.results.filter((r) => !r.success);
      if (failed.length === 0) {
        setResult({ type: "success", message: `${succeeded} event(s) denied.` });
      } else {
        setResult({
          type: "error",
          message: `${succeeded} denied, ${failed.length} failed: ${failed.map((f) => f.error).join("; ")}`,
        });
      }
      setSelected(new Set());
    });
  }

  return (
    <div>
      {/* Bulk selection bar */}
      {pendingEventIds.length > 0 && (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAll}
              className="text-slate-500 hover:text-slate-700 transition-colors"
              title={allSelected ? "Deselect all" : "Select all"}
            >
              {allSelected ? (
                <CheckSquare className="w-5 h-5 text-primary" />
              ) : someSelected ? (
                <MinusSquare className="w-5 h-5 text-primary" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>
            <span className="text-sm text-slate-600">
              {selected.size > 0
                ? `${selected.size} selected`
                : `${pendingEventIds.length} pending`}
            </span>
          </div>

          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              {isPending && (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              )}
              <button
                onClick={handleBulkApprove}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Approve {selected.size}
              </button>
              <button
                onClick={handleBulkDeny}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Deny {selected.size}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Result feedback */}
      {result && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 mb-3 ${
            result.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {result.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {result.message}
        </div>
      )}

      {/* Render event cards with checkboxes injected via context */}
      <BulkSelectionContext.Provider
        value={{ selected, toggleOne, pendingIds: new Set(pendingEventIds) }}
      >
        {children}
      </BulkSelectionContext.Provider>
    </div>
  );
}

// Context for child components to access selection state
import { createContext, useContext } from "react";

const BulkSelectionContext = createContext<{
  selected: Set<string>;
  toggleOne: (id: string) => void;
  pendingIds: Set<string>;
} | null>(null);

export function BulkCheckbox({ eventId }: { eventId: string }) {
  const ctx = useContext(BulkSelectionContext);
  if (!ctx || !ctx.pendingIds.has(eventId)) return null;

  const isSelected = ctx.selected.has(eventId);

  return (
    <button
      onClick={() => ctx.toggleOne(eventId)}
      className="shrink-0 text-slate-400 hover:text-primary transition-colors"
    >
      {isSelected ? (
        <CheckSquare className="w-5 h-5 text-primary" />
      ) : (
        <Square className="w-5 h-5" />
      )}
    </button>
  );
}
