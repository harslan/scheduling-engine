"use client";

import { updateEventType, deleteEventType } from "@/lib/actions/event-types";
import { Edit, Trash2, Save, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";

const COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-red-500",
  "bg-purple-500", "bg-pink-500", "bg-cyan-500", "bg-orange-500",
  "bg-teal-500", "bg-indigo-500", "bg-lime-500", "bg-rose-500",
];

interface EventTypeData {
  id: string;
  name: string;
  colorIndex: number | null;
  iconTextOverride: string;
  eventCount: number;
}

export function EventTypeRow({
  eventType,
  orgSlug,
}: {
  eventType: EventTypeData;
  orgSlug: string;
}) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleDelete() {
    if (eventType.eventCount > 0) {
      setError("This event type has events and cannot be deleted.");
      return;
    }
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    setLoading(true);
    setError("");
    const result = await deleteEventType(eventType.id);
    if (result.error) setError(result.error);
    setLoading(false);
    setConfirmingDelete(false);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await updateEventType(eventType.id, formData);
    if (result.error) {
      setError(result.error);
    } else {
      setEditing(false);
    }
    setLoading(false);
  }

  const colorClass = COLORS[eventType.colorIndex ?? 0] || COLORS[0];

  if (editing) {
    return (
      <tr className="border-b border-slate-100 bg-primary/5">
        <td colSpan={5} className="px-4 py-3">
          <form onSubmit={handleSave} className="flex items-center gap-3">
            {error && <div className="text-sm text-red-600">{error}</div>}
            <input
              name="name"
              defaultValue={eventType.name}
              required
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm w-48"
            />
            <select
              name="colorIndex"
              defaultValue={eventType.colorIndex ?? 0}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
            >
              {COLORS.map((_, i) => (
                <option key={i} value={i}>Color {i + 1}</option>
              ))}
            </select>
            <input
              name="iconTextOverride"
              defaultValue={eventType.iconTextOverride}
              maxLength={4}
              placeholder="Icon"
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm w-16"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-xl text-sm font-medium"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-slate-500 text-sm"
            >
              Cancel
            </button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-3">
        <div className={`w-4 h-4 rounded-full ${colorClass}`} />
      </td>
      <td className="px-4 py-3 font-medium text-slate-900">
        {eventType.name}
        {error && (
          <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {error}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-400">
        {eventType.iconTextOverride || "—"}
      </td>
      <td className="px-4 py-3 text-center text-sm text-slate-600">
        {eventType.eventCount}
      </td>
      <td className="px-4 py-3 text-right">
        {confirmingDelete ? (
          <div className="flex items-center justify-end gap-1.5 text-xs">
            <span className="text-red-600 font-medium">Delete?</span>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-2 py-0.5 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="px-2 py-0.5 text-slate-500 hover:text-slate-700 transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors"
              aria-label={`Edit ${eventType.name}`}
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              aria-label={`Delete ${eventType.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
