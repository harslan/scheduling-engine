import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Building2, Users, Calendar, ExternalLink } from "lucide-react";

export default async function SystemAdminPage() {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          members: true,
          rooms: true,
          events: true,
        },
      },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Organizations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {orgs.length} organization{orgs.length !== 1 ? "s" : ""} on this instance
          </p>
        </div>
        <Link
          href="/admin/create"
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Organization
        </Link>
      </div>

      {orgs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-lg mb-4">No organizations yet</p>
          <Link
            href="/admin/create"
            className="text-primary font-semibold hover:underline"
          >
            Create your first organization
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {orgs.map((org) => (
            <div
              key={org.id}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: org.primaryColor || "#0B7DE6" }}
                  >
                    {org.shortName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      {org.appDisplayName || org.name}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      /{org.slug} · {org.timezone}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {org._count.members}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      {org._count.rooms}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {org._count.events}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/${org.slug}/admin`}
                      className="text-xs font-medium text-primary hover:text-primary-dark transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/5"
                    >
                      Manage
                    </Link>
                    <Link
                      href={`/${org.slug}`}
                      target="_blank"
                      className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-50"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Feature badges */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {org.requiresApproval && (
                  <Badge>Approval Required</Badge>
                )}
                {org.calendarIsPrivate && (
                  <Badge>Private Calendar</Badge>
                )}
                {org.reserveEnabled && (
                  <Badge>Reserve Integration</Badge>
                )}
                {org.allowsUnregisteredUsers && (
                  <Badge>Guest Access</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 uppercase tracking-wider">
      {children}
    </span>
  );
}
