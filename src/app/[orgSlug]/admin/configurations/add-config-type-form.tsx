"use client";

import { createConfigurationType } from "@/lib/actions/configurations";
import { useState } from "react";
import { Plus } from "lucide-react";

export function AddConfigTypeForm({
  organizationId,
  orgSlug,
}: {
  organizationId: string;
  orgSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("organizationId", organizationId);

    const result = await createConfigurationType(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setOpen(false);
      (e.target as HTMLFormElement).reset();
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors mb-6"
      >
        <Plus className="w-4 h-4" />
        Add Configuration Type
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-6"
    >
      <h3 className="font-semibold text-slate-900 mb-3">
        New Configuration Type
      </h3>
      {error && (
        <div className="text-sm text-red-600 mb-3">{error}</div>
      )}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            name="name"
            required
            placeholder="e.g., Theater, Classroom, Boardroom"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 text-slate-500 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
