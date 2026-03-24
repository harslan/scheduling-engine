"use client";

import { toggleRoomActive, deleteRoom, updateRoom } from "@/lib/actions/rooms";
import { Check, X, Edit, Trash2, Save } from "lucide-react";
import { useState } from "react";

interface RoomData {
  id: string;
  name: string;
  iconText: string;
  active: boolean;
  managersOnly: boolean;
  concurrentEventLimit: number;
  notes: string;
  sortOrder: number;
  eventCount: number;
}

export function RoomRow({ room, orgSlug }: { room: RoomData; orgSlug: string }) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleToggle() {
    setLoading(true);
    await toggleRoomActive(room.id);
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm(room.eventCount > 0 ? "This room has events. It will be deactivated instead of deleted." : "Delete this room?")) return;
    setLoading(true);
    await deleteRoom(room.id);
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await updateRoom(room.id, formData);

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
        <td colSpan={7} className="px-4 py-3">
          <form onSubmit={handleSave} className="flex items-center gap-3 flex-wrap">
            {error && (
              <div className="w-full text-sm text-red-600 mb-2">{error}</div>
            )}
            <input
              name="name"
              defaultValue={room.name}
              required
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm w-40"
            />
            <input
              name="iconText"
              defaultValue={room.iconText}
              maxLength={4}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm w-16"
            />
            <input
              name="concurrentEventLimit"
              type="number"
              min={1}
              defaultValue={room.concurrentEventLimit}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm w-16"
            />
            <label className="flex items-center gap-1 text-sm">
              <input
                name="managersOnly"
                type="checkbox"
                value="true"
                defaultChecked={room.managersOnly}
              />
              Mgr only
            </label>
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
    <tr className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${!room.active ? "opacity-50" : ""}`}>
      <td className="px-4 py-3 font-medium text-slate-900">
        {room.name}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center justify-center w-8 h-6 bg-primary/10 text-primary rounded text-xs font-bold">
          {room.iconText}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <button onClick={handleToggle} disabled={loading} className="mx-auto block">
          {room.active ? (
            <Check className="w-4 h-4 text-emerald-500" />
          ) : (
            <X className="w-4 h-4 text-slate-300" />
          )}
        </button>
      </td>
      <td className="px-4 py-3 text-center">
        {room.managersOnly ? (
          <Check className="w-4 h-4 text-amber-500 mx-auto" />
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center text-sm text-slate-600">
        {room.concurrentEventLimit}
      </td>
      <td className="px-4 py-3 text-center text-sm text-slate-400">
        {room.eventCount}
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
