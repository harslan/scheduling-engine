"use client";

import {
  updateConfigurationType,
  deleteConfigurationType,
} from "@/lib/actions/configurations";
import { Edit, Trash2, Save, AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";

interface ConfigTypeData {
  id: string;
  name: string;
  imageUrl: string | null;
  configCount: number;
  eventCount: number;
}

export function ConfigTypeRow({
  configType,
  orgSlug,
}: {
  configType: ConfigTypeData;
  orgSlug: string;
}) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleDelete() {
    if (configType.configCount > 0 || configType.eventCount > 0) {
      setError("This type is in use by configurations or events and cannot be deleted.");
      return;
    }

    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    setLoading(true);
    setError("");
    const result = await deleteConfigurationType(configType.id);
    if (result.error) setError(result.error);
    setLoading(false);
    setConfirmingDelete(false);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await updateConfigurationType(configType.id, formData);

    if (result.error) {
      setError(result.error);
    } else {
      setEditing(false);
    }
    setLoading(false);
  }

  if (editing) {
    return (
      <tr className="border-b border-slate-100 bg-primary/5">
        <td colSpan={4} className="px-4 py-3">
          <form onSubmit={handleSave} className="space-y-2">
            {error && (
              <div className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                name="name"
                defaultValue={configType.name}
                required
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setError(""); }}
                  className="px-3 py-1.5 text-slate-500 text-sm hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-3 font-medium text-slate-900">
        {configType.name}
        {error && (
          <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {error}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-center text-sm text-slate-600">
        {configType.configCount}
      </td>
      <td className="px-4 py-3 text-center text-sm text-slate-600">
        {configType.eventCount}
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
              aria-label={`Edit ${configType.name}`}
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              aria-label={`Delete ${configType.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
