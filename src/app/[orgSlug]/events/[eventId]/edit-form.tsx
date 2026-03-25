"use client";

import { updateEvent } from "@/lib/actions/event-update";
import { Save, X, Loader2 } from "lucide-react";
import { useState } from "react";

interface Props {
  event: {
    id: string;
    title: string;
    eventTypeId: string | null;
    roomId: string | null;
    startDateTime: string;
    endDateTime: string;
    expectedAttendeeCount: number | null;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    notes: string;
  };
  rooms: { id: string; name: string }[];
  eventTypes: { id: string; name: string }[];
  orgSlug: string;
  onCancel: () => void;
  onSaved: () => void;
}

export function EditEventForm({
  event,
  rooms,
  eventTypes,
  orgSlug,
  onCancel,
  onSaved,
}: Props) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await updateEvent(event.id, formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onSaved();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label htmlFor="edit-title" className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
          <input
            id="edit-title"
            name="title"
            defaultValue={event.title}
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
        </div>

        {eventTypes.length > 0 && (
          <div>
            <label htmlFor="edit-eventType" className="block text-sm font-medium text-slate-700 mb-1">Event Type</label>
            <select
              id="edit-eventType"
              name="eventTypeId"
              defaultValue={event.eventTypeId || ""}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
            >
              <option value="">None</option>
              {eventTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {rooms.length > 0 && (
          <div>
            <label htmlFor="edit-room" className="block text-sm font-medium text-slate-700 mb-1">Room</label>
            <select
              id="edit-room"
              name="roomId"
              defaultValue={event.roomId || ""}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
            >
              <option value="">None</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="edit-start" className="block text-sm font-medium text-slate-700 mb-1">Start *</label>
          <input
            id="edit-start"
            name="startDateTime"
            type="datetime-local"
            defaultValue={event.startDateTime}
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
        </div>

        <div>
          <label htmlFor="edit-end" className="block text-sm font-medium text-slate-700 mb-1">End *</label>
          <input
            id="edit-end"
            name="endDateTime"
            type="datetime-local"
            defaultValue={event.endDateTime}
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
        </div>

        <div>
          <label htmlFor="edit-attendees" className="block text-sm font-medium text-slate-700 mb-1">Attendees</label>
          <input
            id="edit-attendees"
            name="expectedAttendeeCount"
            type="number"
            min={1}
            defaultValue={event.expectedAttendeeCount ?? ""}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
        </div>

        <div>
          <label htmlFor="edit-contactName" className="block text-sm font-medium text-slate-700 mb-1">Contact Name *</label>
          <input
            id="edit-contactName"
            name="contactName"
            defaultValue={event.contactName}
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
        </div>

        <div>
          <label htmlFor="edit-contactEmail" className="block text-sm font-medium text-slate-700 mb-1">Contact Email *</label>
          <input
            id="edit-contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={event.contactEmail}
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
        </div>

        <div>
          <label htmlFor="edit-phone" className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
          <input
            id="edit-phone"
            name="contactPhone"
            defaultValue={event.contactPhone}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="edit-notes" className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            id="edit-notes"
            name="notes"
            rows={3}
            defaultValue={event.notes}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none resize-y"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {loading ? "Saving..." : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </form>
  );
}
