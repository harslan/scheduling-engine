import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Calendar,
  Users,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Tag,
  Layers,
  BarChart3,
  FileSpreadsheet,
  Settings,
  ArrowLeftRight,
} from "lucide-react";

export const revalidate = 0;

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  // Gather stats in parallel
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalEvents,
    pendingCount,
    approvedCount,
    deniedCount,
    cancelledCount,
    last30DaysEvents,
    last7DaysEvents,
    upcomingEvents,
    roomCount,
    activeRoomCount,
    memberCount,
    recentActivity,
  ] = await Promise.all([
    prisma.event.count({
      where: { organizationId: org.id, deleted: false },
    }),
    prisma.event.count({
      where: { organizationId: org.id, deleted: false, status: "PENDING" },
    }),
    prisma.event.count({
      where: { organizationId: org.id, deleted: false, status: "APPROVED" },
    }),
    prisma.event.count({
      where: { organizationId: org.id, deleted: false, status: "DENIED" },
    }),
    prisma.event.count({
      where: { organizationId: org.id, deleted: false, status: "CANCELLED" },
    }),
    prisma.event.count({
      where: {
        organizationId: org.id,
        deleted: false,
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.event.count({
      where: {
        organizationId: org.id,
        deleted: false,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.event.count({
      where: {
        organizationId: org.id,
        deleted: false,
        status: "APPROVED",
        startDateTime: { gte: now },
      },
    }),
    prisma.room.count({
      where: { organizationId: org.id },
    }),
    prisma.room.count({
      where: { organizationId: org.id, active: true },
    }),
    prisma.organizationMember.count({
      where: { organizationId: org.id },
    }),
    prisma.eventActivity.findMany({
      where: {
        event: { organizationId: org.id },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        event: { select: { title: true, id: true } },
      },
    }),
  ]);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Overview of {org.appDisplayName || org.name}
          </p>
        </div>
        {pendingCount > 0 && (
          <Link
            href={`/${orgSlug}/admin/approvals`}
            className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
          >
            <AlertCircle className="w-4 h-4" />
            {pendingCount} pending approval{pendingCount !== 1 ? "s" : ""}
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label={`Total ${org.eventPluralTerm}`}
          value={totalEvents}
          icon={<Calendar className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Upcoming"
          value={upcomingEvents}
          icon={<Clock className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          label={`Active ${org.roomTerm}s`}
          value={activeRoomCount}
          subtitle={`of ${roomCount} total`}
          icon={<Building2 className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          label="Members"
          value={memberCount}
          icon={<Users className="w-5 h-5" />}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Status breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 lg:col-span-1">
          <h3 className="font-semibold text-slate-900 mb-4">{org.eventSingularTerm} Status</h3>
          <div className="space-y-3">
            <StatusRow
              label="Approved"
              count={approvedCount}
              total={totalEvents}
              icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
              color="bg-green-500"
            />
            <StatusRow
              label="Pending"
              count={pendingCount}
              total={totalEvents}
              icon={<Clock className="w-4 h-4 text-amber-500" />}
              color="bg-amber-500"
            />
            <StatusRow
              label="Denied"
              count={deniedCount}
              total={totalEvents}
              icon={<XCircle className="w-4 h-4 text-red-500" />}
              color="bg-red-500"
            />
            <StatusRow
              label="Cancelled"
              count={cancelledCount}
              total={totalEvents}
              icon={<XCircle className="w-4 h-4 text-slate-400" />}
              color="bg-slate-400"
            />
          </div>
        </div>

        {/* Activity trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 lg:col-span-1">
          <h3 className="font-semibold text-slate-900 mb-4">Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Last 7 days</span>
              <span className="text-2xl font-bold text-slate-900">
                {last7DaysEvents}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Last 30 days</span>
              <span className="text-2xl font-bold text-slate-900">
                {last30DaysEvents}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">All time</span>
              <span className="text-2xl font-bold text-slate-900">
                {totalEvents}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <TrendingUp className="w-4 h-4 text-green-500" />
                {last7DaysEvents} new {last7DaysEvents !== 1 ? org.eventPluralTerm.toLowerCase() : org.eventSingularTerm.toLowerCase()}{" "}
                this week
              </div>
            </div>
          </div>
        </div>

        {/* Recent activity log */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 lg:col-span-1">
          <h3 className="font-semibold text-slate-900 mb-4">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-400">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {activity.action === "EVENT_APPROVED" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : activity.action === "EVENT_DENIED" ? (
                      <XCircle className="w-4 h-4 text-red-500" />
                    ) : activity.action === "EVENT_SUBMITTED" ? (
                      <Calendar className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700 truncate">
                      <Link
                        href={`/${orgSlug}/events/${activity.eventId}`}
                        className="font-medium hover:text-primary"
                      >
                        {activity.event.title}
                      </Link>
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatAction(activity.action)}
                      {activity.actorEmail
                        ? ` by ${activity.actorEmail}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <h3 className="font-semibold text-slate-900 mb-4">Administration</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AdminCard
          href={`/${orgSlug}/admin/approvals`}
          icon={<Shield className="w-5 h-5" />}
          title="Approvals"
          description={`Review and manage pending ${org.eventSingularTerm.toLowerCase()} requests`}
          badge={pendingCount > 0 ? pendingCount : undefined}
        />
        <AdminCard
          href={`/${orgSlug}/admin/rooms`}
          icon={<Building2 className="w-5 h-5" />}
          title={`${org.roomTerm}s`}
          description={`Manage ${org.roomTerm.toLowerCase()}s, configurations, and capacity`}
        />
        <AdminCard
          href={`/${orgSlug}/admin/event-types`}
          icon={<Tag className="w-5 h-5" />}
          title={`${org.eventSingularTerm} Types`}
          description={`Create and manage ${org.eventSingularTerm.toLowerCase()} categories`}
        />
        <AdminCard
          href={`/${orgSlug}/admin/configurations`}
          icon={<Layers className="w-5 h-5" />}
          title="Configurations"
          description={`${org.roomTerm} setup styles (Theater, Classroom, etc.)`}
        />
        <AdminCard
          href={`/${orgSlug}/admin/users`}
          icon={<Users className="w-5 h-5" />}
          title="Users"
          description="Manage members and role assignments"
        />
        <AdminCard
          href={`/${orgSlug}/admin/reports`}
          icon={<BarChart3 className="w-5 h-5" />}
          title="Reports"
          description="Usage analytics and trend data"
        />
        <AdminCard
          href={`/${orgSlug}/admin/import`}
          icon={<FileSpreadsheet className="w-5 h-5" />}
          title="Import / Export"
          description="CSV import and event data export"
        />
        <AdminCard
          href={`/${orgSlug}/admin/reserve`}
          icon={<ArrowLeftRight className="w-5 h-5" />}
          title="Reserve Interactive"
          description="Bidirectional sync with Reserve Interactive (Infor SCS)"
        />
        <AdminCard
          href={`/${orgSlug}/admin/organization`}
          icon={<Settings className="w-5 h-5" />}
          title="Organization"
          description="Name, branding, features, and scheduling rules"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  icon,
  color,
}: {
  label: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "purple" | "orange";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}
        >
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {subtitle && (
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function StatusRow({
  label,
  count,
  total,
  icon,
  color,
}: {
  label: string;
  count: number;
  total: number;
  icon: React.ReactNode;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm text-slate-700">{label}</span>
        </div>
        <span className="text-sm font-medium text-slate-900">
          {count}{" "}
          <span className="text-slate-400 font-normal">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AdminCard({
  href,
  icon,
  title,
  description,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-primary/20 transition-all group relative"
    >
      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-3 group-hover:bg-primary group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500">{description}</p>
      {badge !== undefined && (
        <span className="absolute top-4 right-4 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </Link>
  );
}

function formatAction(action: string): string {
  switch (action) {
    case "EVENT_SUBMITTED":
      return "Submitted";
    case "EVENT_APPROVED":
      return "Approved";
    case "EVENT_DENIED":
      return "Denied";
    case "EVENT_UPDATED":
      return "Updated";
    case "EVENT_CANCELLED":
      return "Cancelled";
    default:
      return action;
  }
}
