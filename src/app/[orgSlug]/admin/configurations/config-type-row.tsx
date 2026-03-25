"use client";

import {
  updateConfigurationType,
  deleteConfigurationType,
} from "@/lib/actions/configurations";
import { Edit, Trash2, Save } from "lucide-react";
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

  async function handleDelete() {
    if (configType.configCount > 0 || configType.eventCount > 0) {
      setError("This type is in use by configurations or events and cannot be deleted.");
      return;
    }
    if (!confirm("Delete this configuration type? This cannot be undone.")) return;

    setLoading(true);
    setError("");
    const result = await deleteConfigurationType(configType.id);
    if (result.error) setError(result.error);
    setLoading(false);
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
          <form onSubmit={handleSave} className="flex items-center gap-3">
            {error && (
              <div className="text-sm text-red-600">{error}</div>
            )}
            <input
              name="name"
              defaultValue={configType.name}
              required
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm w-48"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              Save
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
      <td className="px-4 py-3 font-medium text-slate-900">
        {configType.name}
      </td>
      <td className="px-4 py-3 text-center text-sm text-slate-600">
        {configType.configCount}
      </td>
      <td className="px-4 py-3 text-center text-sm text-slate-600">
        {configType.eventCount}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
