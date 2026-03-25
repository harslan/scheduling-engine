"use client";

import { updateOrganization } from "@/lib/actions/organization";
import { Save } from "lucide-react";
import { useState } from "react";

interface OrgData {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  appDisplayName: string;
  timezone: string;
  primaryColor: string;
  messageBoardHtml: string;
  allowsRoomSelection: boolean;
  allowsMultiDayEvents: boolean;
  allowsRoomlessEvents: boolean;
  allowsUnregisteredUsers: boolean;
  calendarIsPrivate: boolean;
  requiresApproval: boolean;
  allowsEventChanges: boolean;
  allowsRoomRequests: boolean;
  collectsAttendeeCount: boolean;
  collectsContactPhone: boolean;
  roomOpeningTime: string;
  roomClosingTime: string;
  maxEventLengthMinutes: number;
  schedulingCutoffDays: number | null;
  eventSingularTerm: string;
  eventPluralTerm: string;
  roomTerm: string;
  emailReplyToAddress: string;
}

export function OrgSettingsForm({
  org,
  orgSlug,
}: {
  org: OrgData;
  orgSlug: string;
}) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const result = await updateOrganization(org.id, formData);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">
          Settings saved successfully.
        </div>
      )}

      {/* General */}
      <Section title="General">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Organization Name">
            <input name="name" defaultValue={org.name} required className={inputCls} />
          </Field>
          <Field label="Short Name">
            <input name="shortName" defaultValue={org.shortName} required className={inputCls} />
          </Field>
          <Field label="Display Name (header)">
            <input name="appDisplayName" defaultValue={org.appDisplayName} className={inputCls} placeholder="Shown in the header bar" />
          </Field>
          <Field label="Timezone">
            <input name="timezone" defaultValue={org.timezone} className={inputCls} />
          </Field>
          <Field label="Primary Color">
            <div className="flex items-center gap-2">
              <input name="primaryColor" defaultValue={org.primaryColor} className={inputCls} />
              <div className="w-9 h-9 rounded-lg border border-slate-200 shrink-0" style={{ backgroundColor: org.primaryColor }} />
            </div>
          </Field>
          <Field label="Reply-To Email">
            <input name="emailReplyToAddress" type="email" defaultValue={org.emailReplyToAddress} className={inputCls} placeholder="noreply@example.com" />
          </Field>
        </div>
      </Section>

      {/* Custom Labels */}
      <Section title="Custom Labels">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Event (singular)">
            <input name="eventSingularTerm" defaultValue={org.eventSingularTerm} className={inputCls} />
          </Field>
          <Field label="Event (plural)">
            <input name="eventPluralTerm" defaultValue={org.eventPluralTerm} className={inputCls} />
          </Field>
          <Field label="Room Term">
            <input name="roomTerm" defaultValue={org.roomTerm} className={inputCls} />
          </Field>
        </div>
      </Section>

      {/* Features */}
      <Section title="Features">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          <Toggle name="requiresApproval" defaultChecked={org.requiresApproval} label="Require approval for submissions" />
          <Toggle name="allowsRoomSelection" defaultChecked={org.allowsRoomSelection} label="Allow room selection" />
          <Toggle name="allowsMultiDayEvents" defaultChecked={org.allowsMultiDayEvents} label="Allow multi-day events" />
          <Toggle name="allowsRoomlessEvents" defaultChecked={org.allowsRoomlessEvents} label="Allow events without a room" />
          <Toggle name="allowsUnregisteredUsers" defaultChecked={org.allowsUnregisteredUsers} label="Allow unregistered users" />
          <Toggle name="calendarIsPrivate" defaultChecked={org.calendarIsPrivate} label="Calendar is private (login required)" />
          <Toggle name="allowsEventChanges" defaultChecked={org.allowsEventChanges} label="Allow event changes after submission" />
          <Toggle name="allowsRoomRequests" defaultChecked={org.allowsRoomRequests} label="Allow room requests" />
          <Toggle name="collectsAttendeeCount" defaultChecked={org.collectsAttendeeCount} label="Collect expected attendee count" />
          <Toggle name="collectsContactPhone" defaultChecked={org.collectsContactPhone} label="Collect contact phone number" />
        </div>
      </Section>

      {/* Scheduling Constraints */}
      <Section title="Scheduling Constraints">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Rooms Open">
            <input name="roomOpeningTime" type="time" defaultValue={org.roomOpeningTime} className={inputCls} />
          </Field>
          <Field label="Rooms Close">
            <input name="roomClosingTime" type="time" defaultValue={org.roomClosingTime} className={inputCls} />
          </Field>
          <Field label="Max Event Length (minutes)">
            <input name="maxEventLengthMinutes" type="number" min={15} defaultValue={org.maxEventLengthMinutes} className={inputCls} />
          </Field>
          <Field label="Scheduling Cutoff (days ahead)">
            <input name="schedulingCutoffDays" type="number" min={0} defaultValue={org.schedulingCutoffDays ?? ""} className={inputCls} placeholder="No limit" />
          </Field>
        </div>
      </Section>

      {/* Message Board */}
      <Section title="Calendar Message Board">
        <Field label="HTML content displayed above the calendar">
          <textarea
            name="messageBoardHtml"
            rows={4}
            defaultValue={org.messageBoardHtml}
            className={`${inputCls} resize-y`}
            placeholder="<p>Welcome to our scheduling system!</p>"
          />
        </Field>
      </Section>

      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {loading ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}

const inputCls =
  "w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all text-sm";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-5 border-l-3 border-primary pl-3">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <input
        name={name}
        type="checkbox"
        value="true"
        defaultChecked={defaultChecked}
        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
      />
      <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
        {label}
      </span>
    </label>
  );
}
