import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CalendarPlus,
  Shield,
  Clock,
  Sparkles,
  Rss,
  HelpCircle,
} from "lucide-react";

export default async function HelpPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Help</h1>
      <p className="text-sm text-slate-500 mb-8">
        How to use the {org.appDisplayName || org.name} scheduling system.
      </p>

      <div className="space-y-4">
        <HelpCard
          icon={<CalendarPlus className="w-5 h-5" />}
          title={`Submitting a ${org.eventSingularTerm}`}
        >
          <p>
            Click <strong>Submit {org.eventSingularTerm}</strong> in the sidebar to request
            a {org.roomTerm.toLowerCase()} booking. Fill out the form with your event details,
            preferred {org.roomTerm.toLowerCase()}, date, and time.
          </p>
          {org.requiresApproval && (
            <p className="mt-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This organization requires approval. Your {org.eventSingularTerm.toLowerCase()} will
              be reviewed by a manager before appearing on the calendar.
            </p>
          )}
        </HelpCard>

        <HelpCard
          icon={<Sparkles className="w-5 h-5" />}
          title="AI Assistant"
        >
          <p>
            Use the <strong>AI Assistant</strong> to book rooms using natural language. Just describe
            what you need — &quot;Book me a {org.roomTerm.toLowerCase()} for tomorrow at 2pm&quot; — and the
            assistant will find available options and create the booking for you.
          </p>
        </HelpCard>

        <HelpCard
          icon={<Clock className="w-5 h-5" />}
          title="Scheduling Rules"
        >
          <ul className="space-y-1.5 list-disc list-inside">
            <li>
              {org.roomTerm}s are available from{" "}
              <strong>{formatTime(org.roomOpeningTime)}</strong> to{" "}
              <strong>{formatTime(org.roomClosingTime)}</strong>
            </li>
            <li>
              Maximum event length: <strong>{org.maxEventLengthMinutes} minutes</strong>
            </li>
            {org.schedulingCutoffDays && (
              <li>
                Events must be booked at least{" "}
                <strong>{org.schedulingCutoffDays} day{org.schedulingCutoffDays !== 1 ? "s" : ""}</strong>{" "}
                in advance
              </li>
            )}
            {org.allowsMultiDayEvents && <li>Multi-day events are allowed</li>}
          </ul>
        </HelpCard>

        {org.requiresApproval && (
          <HelpCard
            icon={<Shield className="w-5 h-5" />}
            title="Approval Process"
          >
            <p>
              After you submit a {org.eventSingularTerm.toLowerCase()}, a manager will review it.
              You&apos;ll be able to see the status on your <strong>My {org.eventPluralTerm}</strong> page.
              Approved events appear on the calendar automatically.
            </p>
          </HelpCard>
        )}

        <HelpCard
          icon={<Rss className="w-5 h-5" />}
          title="Calendar Subscription"
        >
          <p>
            Subscribe to the calendar in Outlook, Google Calendar, or Apple Calendar using this URL:
          </p>
          <code className="block mt-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700 break-all">
            {typeof window !== "undefined" ? window.location.origin : ""}/api/calendar/{orgSlug}
          </code>
          <p className="mt-2 text-sm text-slate-500">
            Copy this URL and add it as a calendar subscription in your calendar app.
          </p>
        </HelpCard>

        <HelpCard
          icon={<HelpCircle className="w-5 h-5" />}
          title="Need More Help?"
        >
          <p>
            Contact your organization administrator for additional support.
          </p>
        </HelpCard>
      </div>
    </div>
  );
}

function HelpCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
          {icon}
        </div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
    </div>
  );
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}
