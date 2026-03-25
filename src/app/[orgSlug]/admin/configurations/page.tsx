import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ConfigTypeRow } from "./config-type-row";
import { AddConfigTypeForm } from "./add-config-type-form";

export default async function AdminConfigurationsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  const configTypes = await prisma.roomConfigurationType.findMany({
    where: { organizationId: org.id },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { configurations: true, events: true } },
    },
  });

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          {org.roomTerm} Configuration Types
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Define setup styles that can be applied to {org.roomTerm.toLowerCase()}s
          (e.g., Theater, Classroom, Boardroom).
          These help users find available {org.roomTerm.toLowerCase()}s with matching setups.
        </p>
      </div>

      <AddConfigTypeForm organizationId={org.id} orgSlug={orgSlug} />

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Name
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                Configurations
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                Events
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {configTypes.map((ct) => (
              <ConfigTypeRow
                key={ct.id}
                configType={{
                  id: ct.id,
                  name: ct.name,
                  imageUrl: ct.imageUrl,
                  configCount: ct._count.configurations,
                  eventCount: ct._count.events,
                }}
                orgSlug={orgSlug}
              />
            ))}
          </tbody>
        </table>
        {configTypes.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            No configuration types yet. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}
