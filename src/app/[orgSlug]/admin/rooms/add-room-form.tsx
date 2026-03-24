"use client";

import { createRoom } from "@/lib/actions/rooms";
import { Plus } from "lucide-react";
import { useState } from "react";

export function AddRoomForm({
  organizationId,
  orgSlug,
  roomTerm,
}: {
  organizationId: string;
  orgSlug: string;
  roomTerm: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("organizationId", organizationId);

    const result = await createRoom(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setOpen(false);
      setLoading(false);
      (e.target as HTMLFormElement).reset();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors mb-4"
      >
        <Plus className="w-4 h-4" />
        Add {roomTerm}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-primary/20 rounded-xl p-5 shadow-sm mb-4 space-y-4"
    >
      <h3 className="font-semibold text-slate-900">Add New {roomTerm}</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
          <input
            name="name"
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
            placeholder="e.g., Conference Room A"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Icon (2-4 chars)</label>
          <input
            name="iconText"
            maxLength={4}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
            placeholder="CR"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Max Concurrent</label>
          <input
            name="concurrentEventLimit"
            type="number"
            min={1}
            defaultValue={1}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <input
          name="notes"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none text-sm"
          placeholder="Building, floor, equipment..."
        />
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input name="managersOnly" type="checkbox" value="true" className="rounded" />
          Managers only
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {loading ? "Adding..." : `Add ${roomTerm}`}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
