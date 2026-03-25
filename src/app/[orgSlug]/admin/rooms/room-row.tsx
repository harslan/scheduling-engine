"use client";

import { toggleRoomActive, deleteRoom, updateRoom } from "@/lib/actions/rooms";
import {
  createRoomConfiguration,
  updateRoomConfiguration,
  deleteRoomConfiguration,
} from "@/lib/actions/configurations";
import { Check, X, Edit, Trash2, Save, ChevronDown, ChevronRight, Plus, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";

interface ConfigData {
  id: string;
  name: string;
  configurationTypeName: string | null;
  configurationTypeId: string | null;
  concurrentEventLimit: number;
  eventCount: number;
}

interface RoomData {
  id: string;
  name: string;
  iconText: string;
  active: boolean;
  managersOnly: boolean;
  concurrentEventLimit: number;
  bufferMinutes: number;
  capacity: number | null;
  notes: string;
  sortOrder: number;
  eventCount: number;
  configurations: ConfigData[];
}

export function RoomRow({
  room,
  configTypes,
  orgSlug,
  mobileMode,
}: {
  room: RoomData;
  configTypes: { id: string; name: string }[];
  orgSlug: string;
  mobileMode?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleToggle() {
    setLoading(true);
    await toggleRoomActive(room.id);
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setLoading(true);
    await deleteRoom(room.id);
    setLoading(false);
    setConfirmingDelete(false);
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

  // Mobile card mode — just show action buttons
  if (mobileMode) {
    if (editing) {
      return (
        <form onSubmit={handleSave} className="space-y-2">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <input name="name" defaultValue={room.name} required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Room name" />
          <div className="grid grid-cols-2 gap-2">
            <input name="iconText" defaultValue={room.iconText} maxLength={4} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Icon" />
            <input name="capacity" type="number" min={1} defaultValue={room.capacity || ""} placeholder="Capacity" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <input name="concurrentEventLimit" type="number" min={1} defaultValue={room.concurrentEventLimit} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Max concurrent" />
            <input name="bufferMinutes" type="number" min={0} defaultValue={room.bufferMinutes} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Buffer (min)" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input name="managersOnly" type="checkbox" value="true" defaultChecked={room.managersOnly} />
            Managers only
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="flex-1 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-2 text-slate-500 text-sm">Cancel</button>
          </div>
        </form>
      );
    }

    return (
      <div>
        {error && <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-2">{error}</div>}
        {confirmingDelete ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-red-600 font-medium">
              {room.eventCount > 0 ? "Room has events — will be deactivated. Continue?" : "Delete this room?"}
            </span>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Yes"}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="px-3 py-1.5 text-slate-500"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)} className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">Edit</button>
            <button onClick={handleToggle} disabled={loading} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
              {room.active ? "Deactivate" : "Activate"}
            </button>
            <button onClick={handleDelete} disabled={loading} className="px-3 py-1.5 text-sm border border-red-200 rounded-lg hover:bg-red-50 text-red-500">Delete</button>
          </div>
        )}
      </div>
    );
  }

  if (editing) {
    return (
      <tr className="border-b border-slate-100 bg-primary/5">
        <td colSpan={8} className="px-4 py-3">
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
              placeholder="Concurrent"
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm w-16"
            />
            <input
              name="bufferMinutes"
              type="number"
              min={0}
              defaultValue={room.bufferMinutes}
              placeholder="Buffer min"
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm w-20"
            />
            <input
              name="capacity"
              type="number"
              min={1}
              defaultValue={room.capacity || ""}
              placeholder="Capacity"
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm w-20"
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
    <>
      <tr className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${!room.active ? "opacity-50" : ""}`}>
        <td className="px-4 py-3 font-medium text-slate-900">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
            {room.name}
            {room.configurations.length > 0 && (
              <span className="text-xs text-slate-400 font-normal">
                ({room.configurations.length} config{room.configurations.length !== 1 ? "s" : ""})
              </span>
            )}
          </button>
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
          {room.bufferMinutes > 0 ? `${room.bufferMinutes}m` : "—"}
        </td>
        <td className="px-4 py-3 text-center text-sm text-slate-400">
          {room.eventCount}
        </td>
        <td className="px-4 py-3 text-right">
          {confirmingDelete ? (
            <div className="flex items-center justify-end gap-1.5 text-xs">
              <span className="text-red-600 font-medium">
                {room.eventCount > 0 ? "Deactivate?" : "Delete?"}
              </span>
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
                aria-label={`Edit ${room.name}`}
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                aria-label={`Delete ${room.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100">
          <td colSpan={8} className="px-4 py-0">
            <ConfigurationsPanel
              roomId={room.id}
              configurations={room.configurations}
              configTypes={configTypes}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function ConfigurationsPanel({
  roomId,
  configurations,
  configTypes,
}: {
  roomId: string;
  configurations: ConfigData[];
  configTypes: { id: string; name: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddLoading(true);
    setAddError("");

    const formData = new FormData(e.currentTarget);
    formData.set("roomId", roomId);

    const result = await createRoomConfiguration(formData);
    if (result.error) {
      setAddError(result.error);
    } else {
      setAdding(false);
    }
    setAddLoading(false);
  }

  return (
    <div className="py-3 pl-8 border-l-2 border-primary/20 ml-2 my-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Configurations
        </p>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>

      {configurations.length === 0 && !adding && (
        <p className="text-xs text-slate-400 italic">No configurations — room uses default settings</p>
      )}

      {configurations.map((config) => (
        <ConfigRow key={config.id} config={config} configTypes={configTypes} />
      ))}

      {adding && (
        <form onSubmit={handleAdd} className="flex items-center gap-2 mt-2 flex-wrap">
          {addError && <div className="w-full text-xs text-red-600">{addError}</div>}
          <input
            name="name"
            required
            placeholder="Configuration name"
            className="px-2 py-1 border border-slate-200 rounded text-xs w-36"
          />
          <select
            name="configurationTypeId"
            className="px-2 py-1 border border-slate-200 rounded text-xs"
          >
            <option value="">No type</option>
            {configTypes.map((ct) => (
              <option key={ct.id} value={ct.id}>{ct.name}</option>
            ))}
          </select>
          <input
            name="concurrentEventLimit"
            type="number"
            min={1}
            defaultValue={1}
            className="px-2 py-1 border border-slate-200 rounded text-xs w-14"
          />
          <button
            type="submit"
            disabled={addLoading}
            className="px-2 py-1 bg-primary text-white rounded text-xs font-medium"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-xs text-slate-400"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

function ConfigRow({
  config,
  configTypes,
}: {
  config: ConfigData;
  configTypes: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const result = await updateRoomConfiguration(config.id, formData);
    if (result.error) {
      setError(result.error);
    } else {
      setEditing(false);
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setLoading(true);
    setError("");
    const result = await deleteRoomConfiguration(config.id);
    if (result.error) setError(result.error);
    setLoading(false);
    setConfirmingDelete(false);
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex items-center gap-2 py-1 flex-wrap">
        <input
          name="name"
          defaultValue={config.name}
          required
          className="px-2 py-1 border border-slate-200 rounded text-xs w-36"
        />
        <select
          name="configurationTypeId"
          defaultValue={config.configurationTypeId || ""}
          className="px-2 py-1 border border-slate-200 rounded text-xs"
        >
          <option value="">No type</option>
          {configTypes.map((ct) => (
            <option key={ct.id} value={ct.id}>{ct.name}</option>
          ))}
        </select>
        <input
          name="concurrentEventLimit"
          type="number"
          min={1}
          defaultValue={config.concurrentEventLimit}
          className="px-2 py-1 border border-slate-200 rounded text-xs w-14"
        />
        <button type="submit" disabled={loading} className="px-2 py-1 bg-primary text-white rounded text-xs">
          <Save className="w-3 h-3" />
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-400">
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div>
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mb-1">
          {error}
        </div>
      )}
    <div className="flex items-center gap-3 py-1.5 group">
      <span className="text-sm text-slate-700">{config.name}</span>
      {config.configurationTypeName && (
        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
          {config.configurationTypeName}
        </span>
      )}
      {config.concurrentEventLimit > 1 && (
        <span className="text-xs text-slate-400">
          max {config.concurrentEventLimit}
        </span>
      )}
      <span className="text-xs text-slate-400">
        {config.eventCount} event{config.eventCount !== 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
        {confirmingDelete ? (
          <>
            <span className="text-xs text-red-600 font-medium mr-1">Delete?</span>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-1.5 py-0.5 bg-red-500 text-white rounded text-xs font-medium"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="px-1.5 py-0.5 text-xs text-slate-500"
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-primary"
            >
              <Edit className="w-3 h-3" />
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
    </div>
    </div>
  );
}
