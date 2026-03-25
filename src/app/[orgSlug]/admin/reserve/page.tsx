import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ReserveSettingsForm } from "./reserve-settings-form";

export const revalidate = 0;

export default async function ReserveSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  const [rooms, configTypes, eventTypes, recentLogs, webhookCount] =
    await Promise.all([
      prisma.room.findMany({
        where: { organizationId: org.id, active: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.roomConfigurationType.findMany({
        where: { organizationId: org.id },
        orderBy: { name: "asc" },
      }),
      prisma.eventType.findMany({
        where: { organizationId: org.id },
        orderBy: { name: "asc" },
      }),
      prisma.reserveSyncLog.findMany({
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.reserveWebhookEvent.count({
        where: { organizationId: org.id, processedAt: null },
      }),
    ]);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Reserve Interactive
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Bidirectional sync with Reserve Interactive (Infor SCS)
          </p>
        </div>
        {org.reserveEnabled && org.reserveImportMode && (
          <Link
            href={`/${orgSlug}/admin/reserve/import`}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Review Imports
          </Link>
        )}
      </div>

      {/* Connection status */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                org.reserveEnabled ? "bg-green-500" : "bg-slate-300"
              }`}
            />
            <div>
              <p className="font-medium text-slate-900">
                {org.reserveEnabled ? "Connected" : "Not Connected"}
              </p>
              {org.reserveLastSyncAt && (
                <p className="text-xs text-slate-400">
                  Last sync:{" "}
                  {new Date(org.reserveLastSyncAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {org.reserveLastExportAt && (
              <span>
                Export:{" "}
                {new Date(org.reserveLastExportAt).toLocaleDateString()}
              </span>
            )}
            {org.reserveLastImportAt && (
              <span>
                Import:{" "}
                {new Date(org.reserveLastImportAt).toLocaleDateString()}
              </span>
            )}
            {webhookCount > 0 && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {webhookCount} pending webhook{webhookCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      <ReserveSettingsForm
        orgId={org.id}
        orgSlug={orgSlug}
        settings={{
          reserveEnabled: org.reserveEnabled,
          reserveExportEnabled: org.reserveExportEnabled,
          reserveImportMode: org.reserveImportMode,
          reserveGatewayUsername: org.reserveGatewayUsername,
          reserveGatewayPassword: org.reserveGatewayPassword,
          reserveWebhookSecret: org.reserveWebhookSecret,
          reserveSiteName: org.reserveSiteName,
          reserveEventIdFieldName: org.reserveEventIdFieldName,
          reserveEventNotesFieldName: org.reserveEventNotesFieldName,
          reserveEventOrgFieldName: org.reserveEventOrgFieldName,
          reserveOwnerUsername: org.reserveOwnerUsername,
          reserveSalespersonUsername: org.reserveSalespersonUsername,
          reserveLifecycleStage: org.reserveLifecycleStage,
          reserveHoldFunctionType: org.reserveHoldFunctionType,
          reserveHoldContactId: org.reserveHoldContactId,
        }}
        rooms={rooms.map((r) => ({
          id: r.id,
          name: r.name,
          reserveLocationName: r.reserveLocationName,
        }))}
        configTypes={configTypes.map((ct) => ({
          id: ct.id,
          name: ct.name,
          reserveSetupStyle: ct.reserveSetupStyle,
        }))}
        eventTypes={eventTypes.map((et) => ({
          id: et.id,
          name: et.name,
          reserveFunctionType: et.reserveFunctionType,
        }))}
        recentLogs={recentLogs.map((log) => ({
          id: log.id,
          direction: log.direction,
          status: log.status,
          eventsProcessed: log.eventsProcessed,
          errorMessage: log.errorMessage,
          createdAt: log.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
