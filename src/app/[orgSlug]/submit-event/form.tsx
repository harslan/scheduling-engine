"use client";

import { submitEvent } from "@/lib/actions/events";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Repeat, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

interface RoomConfig {
  id: string;
  name: string;
  typeName: string | null;
}

interface RoomWithConfigs {
  id: string;
  name: string;
  configurations: RoomConfig[];
}

interface OrgSettings {
  collectsAttendeeCount: boolean;
  collectsContactPhone: boolean;
  roomOpeningTime: string;
  roomClosingTime: string;
  roomTerm: string;
  eventSingularTerm: string;
  eventPluralTerm: string;
}

interface Props {
  organizationId: string;
  orgSlug: string;
  rooms: RoomWithConfigs[];
  eventTypes: { id: string; name: string }[];
  requiresApproval: boolean;
  defaultContactName?: string;
  defaultContactEmail?: string;
  orgSettings: OrgSettings;
}

export function SubmitEventForm({
  organizationId,
  orgSlug,
  rooms,
  eventTypes,
  requiresApproval,
  defaultContactName,
  defaultContactEmail,
  orgSettings,
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

    // Client-side time validation
    const startStr = formData.get("startDateTime") as string;
    const endStr = formData.get("endDateTime") as string;
    if (startStr && endStr) {
      const startDt = new Date(startStr);
      const endDt = new Date(endStr);
      if (endDt <= startDt) {
        setError("End time must be after start time.");
        setLoading(false);
        return;
      }
    }

    const result = await submitEvent(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      // Scroll to top so user sees the error
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
        <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {orgSettings.eventSingularTerm} Submitted!
        </h2>
        <p className="text-slate-500 mb-6">
          {requiresApproval
            ? `Your ${orgSettings.eventSingularTerm.toLowerCase()} has been submitted for approval. You'll receive an email when it's reviewed.`
            : `Your ${orgSettings.eventSingularTerm.toLowerCase()} has been approved and added to the calendar.`}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href={`/${orgSlug}/my-events`}
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            View My {orgSettings.eventPluralTerm} <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={`/${orgSlug}`}
            className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 px-5 py-2.5 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            Back to Calendar
          </Link>
        </div>
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
          This organization requires approval for {orgSettings.eventSingularTerm.toLowerCase()} submissions.
        </div>
      )}

      {/* Event Details */}
      <Section title={`${orgSettings.eventSingularTerm} Details`}>
        <Field label={`${orgSettings.eventSingularTerm} Title`} required>
          <input
            name="title"
            type="text"
            required
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
            placeholder="e.g., Faculty Meeting"
          />
        </Field>

        {eventTypes.length > 0 && (
          <Field label={`${orgSettings.eventSingularTerm} Type`}>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <p className="text-xs text-slate-400 -mt-2">
          Available hours: {orgSettings.roomOpeningTime} – {orgSettings.roomClosingTime}
        </p>

        <Field label="Description">
          <textarea
            name="description"
            rows={3}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all resize-y"
            placeholder="Detailed description of the event..."
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {orgSettings.collectsAttendeeCount && (
            <Field label="Expected Attendees">
              <input
                name="expectedAttendeeCount"
                type="number"
                min="1"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
                placeholder="Number of attendees"
              />
            </Field>
          )}
          <Field label="Website URL">
            <input
              name="websiteUrl"
              type="url"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
              placeholder="https://..."
            />
          </Field>
        </div>
      </Section>

      {/* Recurrence */}
      <RecurrenceSection />

      {/* Room */}
      {rooms.length > 0 && (
        <RoomSection rooms={rooms} roomTerm={orgSettings.roomTerm} />
      )}

      {/* Contact */}
      <Section title="Contact Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        {orgSettings.collectsContactPhone && (
          <Field label="Contact Phone">
            <input
              name="contactPhone"
              type="tel"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
              placeholder="(555) 123-4567"
            />
          </Field>
        )}
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
        className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl text-lg font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Submitting...
          </>
        ) : (
          `Submit ${orgSettings.eventSingularTerm}`
        )}
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

function RecurrenceSection() {
  const [recurrenceType, setRecurrenceType] = useState("none");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Build the hidden RRULE value
  let rruleValue = "";
  if (recurrenceType === "daily") {
    rruleValue = "FREQ=DAILY;INTERVAL=1";
  } else if (recurrenceType === "weekly") {
    rruleValue = "FREQ=WEEKLY;INTERVAL=1";
  } else if (recurrenceType === "weekdays") {
    rruleValue = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR";
  } else if (recurrenceType === "biweekly") {
    rruleValue = "FREQ=WEEKLY;INTERVAL=2";
  } else if (recurrenceType === "monthly") {
    rruleValue = "FREQ=MONTHLY;INTERVAL=1";
  } else if (recurrenceType === "custom-weekly" && selectedDays.length > 0) {
    rruleValue = `FREQ=WEEKLY;INTERVAL=1;BYDAY=${selectedDays.join(",")}`;
  }

  const days = [
    { key: "MO", label: "Mon" },
    { key: "TU", label: "Tue" },
    { key: "WE", label: "Wed" },
    { key: "TH", label: "Thu" },
    { key: "FR", label: "Fri" },
    { key: "SA", label: "Sat" },
    { key: "SU", label: "Sun" },
  ];

  return (
    <Section title="Recurrence">
      <input type="hidden" name="recurrenceRule" value={rruleValue} />

      <Field label="Repeat">
        <div className="flex items-center gap-2">
          <Repeat className="w-4 h-4 text-slate-400" />
          <select
            value={recurrenceType}
            onChange={(e) => {
              setRecurrenceType(e.target.value);
              setSelectedDays([]);
            }}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Every day</option>
            <option value="weekdays">Every weekday (Mon-Fri)</option>
            <option value="weekly">Every week</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Every month</option>
            <option value="custom-weekly">Custom (select days)...</option>
          </select>
        </div>
      </Field>

      {recurrenceType === "custom-weekly" && (
        <Field label="Repeat on">
          <div className="flex gap-2">
            {days.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleDay(key)}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                  selectedDays.includes(key)
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      )}

      {recurrenceType !== "none" && (
        <Field label="Repeat until" required>
          <input
            name="recurrenceEndDate"
            type="date"
            required
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
          />
        </Field>
      )}
    </Section>
  );
}

function RoomSection({ rooms, roomTerm }: { rooms: RoomWithConfigs[]; roomTerm: string }) {
  const [selectedRoomId, setSelectedRoomId] = useState("");

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const hasConfigs = selectedRoom && selectedRoom.configurations.length > 0;

  return (
    <Section title={roomTerm}>
      <Field label={`Select ${roomTerm}`}>
        <select
          name="roomId"
          value={selectedRoomId}
          onChange={(e) => setSelectedRoomId(e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
        >
          <option value="">{`Choose a ${roomTerm.toLowerCase()}...`}</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>

      {hasConfigs && (
        <Field label="Room Configuration">
          <div className="space-y-2">
            {selectedRoom.configurations.map((config) => (
              <label
                key={config.id}
                className="flex items-center gap-3 px-4 py-3 border border-slate-200 rounded-lg cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="roomConfigurationId"
                  value={config.id}
                  className="text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    {config.name}
                  </span>
                  {config.typeName && (
                    <span className="ml-2 text-xs text-slate-400">
                      {config.typeName}
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </Field>
      )}
    </Section>
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
