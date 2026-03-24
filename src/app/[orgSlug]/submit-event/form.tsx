"use client";

import { submitEvent } from "@/lib/actions/events";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

interface Props {
  organizationId: string;
  orgSlug: string;
  rooms: { id: string; name: string }[];
  eventTypes: { id: string; name: string }[];
  requiresApproval: boolean;
  defaultContactName?: string;
  defaultContactEmail?: string;
}

export function SubmitEventForm({
  organizationId,
  orgSlug,
  rooms,
  eventTypes,
  requiresApproval,
  defaultContactName,
  defaultContactEmail,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("organizationId", organizationId);

    const result = await submitEvent(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => router.push(`/${orgSlug}/my-events`), 2000);
    }
  }

  if (success) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
        <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Event Submitted!
        </h2>
        <p className="text-slate-500">
          {requiresApproval
            ? "Your event has been submitted for approval."
            : "Your event has been approved and added to the calendar."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {requiresApproval && (
        <div className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-lg px-4 py-3 text-sm text-amber-800">
          This organization requires approval for event submissions.
        </div>
      )}

      {/* Event Details */}
      <Section title="Event Details">
        <Field label="Event Title" required>
          <input
            name="title"
            type="text"
            required
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
            placeholder="e.g., Faculty Meeting"
          />
        </Field>

        {eventTypes.length > 0 && (
          <Field label="Event Type">
            <select
              name="eventTypeId"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
            >
              <option value="">Select type...</option>
              {eventTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Date & Time" required>
            <input
              name="startDateTime"
              type="datetime-local"
              required
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
            />
          </Field>
          <Field label="End Date & Time" required>
            <input
              name="endDateTime"
              type="datetime-local"
              required
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
            />
          </Field>
        </div>

        <Field label="Expected Attendees">
          <input
            name="expectedAttendeeCount"
            type="number"
            min="1"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
            placeholder="Number of attendees"
          />
        </Field>
      </Section>

      {/* Room */}
      {rooms.length > 0 && (
        <Section title="Room">
          <Field label="Select Room">
            <select
              name="roomId"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
            >
              <option value="">Choose a room...</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        </Section>
      )}

      {/* Contact */}
      <Section title="Contact Information">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact Name" required>
            <input
              name="contactName"
              type="text"
              required
              defaultValue={defaultContactName}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
              placeholder="Your name"
            />
          </Field>
          <Field label="Contact Email" required>
            <input
              name="contactEmail"
              type="email"
              required
              defaultValue={defaultContactEmail}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
              placeholder="you@example.com"
            />
          </Field>
        </div>
        <Field label="Additional Notes">
          <textarea
            name="notes"
            rows={3}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all resize-y"
            placeholder="Any special requirements..."
          />
        </Field>
      </Section>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-white py-3 rounded-xl text-lg font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit Event"}
      </button>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-5 border-l-3 border-primary pl-3">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
