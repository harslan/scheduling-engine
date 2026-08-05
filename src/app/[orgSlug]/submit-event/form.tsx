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

interface DefaultValues {
  title?: string;
  eventTypeId?: string;
  roomId?: string;
  description?: string;
  expectedAttendeeCount?: string;
  websiteUrl?: string;
  contactPhone?: string;
  notes?: string;
}

interface Props {
  organizationId: string;
  orgSlug: string;
  rooms: RoomWithConfigs[];
  eventTypes: { id: string; name: string }[];
  requiresApproval: boolean;
  isAdminOrManager?: boolean;
  defaultContactName?: string;
  defaultContactEmail?: string;
  defaultValues?: DefaultValues;
  orgSettings: OrgSettings;
}

export function SubmitEventForm({
  organizationId,
  orgSlug,
  rooms,
  eventTypes,
  requiresApproval,
  isAdminOrManager,
  defaultContactName,
  defaultContactEmail,
  defaultValues,
  orgSettings,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<
    { roomName: string; message: string; reason: string }[]
  >([]);
  const [alternatives, setAlternatives] = useState<
    { roomId: string; roomName: string; configurationId?: string }[]
  >([]);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(defaultValues?.roomId || "");
  const [startDateValue, setStartDateValue] = useState("");

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
      setConflicts(result.conflicts || []);
      setAlternatives(result.alternatives || []);
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
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors"
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
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 space-y-2">
          {conflicts.length > 0 ? (
            <>
              <p className="font-semibold">Scheduling Conflicts:</p>
              <ul className="list-disc pl-5 space-y-1">
                {conflicts.map((c, i) => (
                  <li key={i}>{c.message}</li>
                ))}
              </ul>
              {alternatives.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
                  <p className="font-semibold text-sm mb-2">
                    Available alternative {orgSettings.roomTerm.toLowerCase()}s:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {alternatives.map((alt) => (
                      <button
                        key={alt.roomId}
                        type="button"
                        onClick={() => {
                          setSelectedRoomId(alt.roomId);
                          setError("");
                          setConflicts([]);
                          setAlternatives([]);
                        }}
                        className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-lg text-sm font-medium transition-colors"
                      >
                        Select {alt.roomName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p>{error}</p>
          )}
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
            defaultValue={defaultValues?.title}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
            placeholder="e.g., Faculty Meeting"
          />
        </Field>

        {eventTypes.length > 0 && (
          <Field label={`${orgSettings.eventSingularTerm} Type`}>
            <select
              name="eventTypeId"
              defaultValue={defaultValues?.eventTypeId}
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
              value={startDateValue}
              onChange={(e) => setStartDateValue(e.target.value)}
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
            defaultValue={defaultValues?.description}
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
                defaultValue={defaultValues?.expectedAttendeeCount}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
                placeholder="Number of attendees"
              />
            </Field>
          )}
          <Field label="Website URL">
            <input
              name="websiteUrl"
              type="url"
              defaultValue={defaultValues?.websiteUrl}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
              placeholder="https://..."
            />
          </Field>
        </div>
      </Section>

      {/* Recurrence */}
      <RecurrenceSection startDateValue={startDateValue} />

      {/* Room */}
      {rooms.length > 0 && (
        <RoomSection
          rooms={rooms}
          roomTerm={orgSettings.roomTerm}
          selectedRoomId={selectedRoomId}
          onRoomChange={setSelectedRoomId}
        />
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
              defaultValue={defaultValues?.contactPhone}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
              placeholder="(555) 123-4567"
            />
          </Field>
        )}
        <Field label="Additional Notes">
          <textarea
            name="notes"
            rows={3}
            defaultValue={defaultValues?.notes}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all resize-y"
            placeholder="Any special requirements..."
          />
        </Field>
      </Section>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="emailUpdates"
            name="emailUpdates"
            value="true"
            defaultChecked
            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
          />
          <label htmlFor="emailUpdates" className="text-sm text-slate-600">
            Receive email notifications about this {orgSettings.eventSingularTerm.toLowerCase()}
          </label>
        </div>

        {isAdminOrManager && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="overrideBuffer"
              name="overrideBuffer"
              value="true"
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
            />
            <label htmlFor="overrideBuffer" className="text-sm text-slate-600">
              Override buffer/reconfiguration time requirements
            </label>
          </div>
        )}
      </div>

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

function RecurrenceSection({ startDateValue }: { startDateValue: string }) {
  const [recurrenceType, setRecurrenceType] = useState("none");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [newExcludedDate, setNewExcludedDate] = useState("");

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Compute monthly-by-day-of-week label from start date (e.g., "Monthly on the 2nd Tuesday")
  const dayAbbrs = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const ordinalLabels = ["1st", "2nd", "3rd", "4th"];
  let monthlyDowLabel = "";
  let monthlyDowRRule = "";
  if (startDateValue) {
    const d = new Date(startDateValue);
    if (!isNaN(d.getTime())) {
      const dow = d.getDay();
      const ordinal = Math.floor((d.getDate() - 1) / 7); // 0-based
      if (ordinal < 4) {
        monthlyDowLabel = `Monthly on the ${ordinalLabels[ordinal]} ${dayLabels[dow]}`;
        monthlyDowRRule = `FREQ=MONTHLY;INTERVAL=1;BYDAY=${ordinal + 1}${dayAbbrs[dow]}`;
      }
    }
  }

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
  } else if (recurrenceType === "monthly-dow" && monthlyDowRRule) {
    rruleValue = monthlyDowRRule;
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
            <option value="monthly">Every month (same date)</option>
            {monthlyDowLabel && (
              <option value="monthly-dow">{monthlyDowLabel}</option>
            )}
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

      {recurrenceType !== "none" && (
        <Field label="Excluded dates (optional)">
          {excludedDates.map((d) => (
            <input key={d} type="hidden" name="excludedDates" value={d} />
          ))}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="date"
                value={newExcludedDate}
                onChange={(e) => setNewExcludedDate(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => {
                  if (newExcludedDate && !excludedDates.includes(newExcludedDate)) {
                    setExcludedDates((prev) => [...prev, newExcludedDate].sort());
                    setNewExcludedDate("");
                  }
                }}
                disabled={!newExcludedDate}
                className="px-3 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {excludedDates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {excludedDates.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg"
                  >
                    {new Date(d + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                    <button
                      type="button"
                      onClick={() => setExcludedDates((prev) => prev.filter((x) => x !== d))}
                      className="text-amber-500 hover:text-amber-700 ml-0.5"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400">
              Skip specific dates (holidays, closures, etc.)
            </p>
          </div>
        </Field>
      )}
    </Section>
  );
}

function RoomSection({
  rooms,
  roomTerm,
  selectedRoomId,
  onRoomChange,
}: {
  rooms: RoomWithConfigs[];
  roomTerm: string;
  selectedRoomId: string;
  onRoomChange: (id: string) => void;
}) {
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const hasConfigs = selectedRoom && selectedRoom.configurations.length > 0;

  return (
    <Section title={roomTerm}>
      <Field label={`Select ${roomTerm}`}>
        <select
          name="roomId"
          value={selectedRoomId}
          onChange={(e) => onRoomChange(e.target.value)}
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
