import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Plus, Check, X } from "lucide-react";
import { RoomRow } from "./room-row";
import { AddRoomForm } from "./add-room-form";

export default async function AdminRoomsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  const [rooms, configTypes] = await Promise.all([
    prisma.room.findMany({
      where: { organizationId: org.id },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { events: true } },
        configurations: {
          include: {
            configurationType: true,
            _count: { select: { events: true } },
          },
        },
      },
    }),
    prisma.roomConfigurationType.findMany({
      where: { organizationId: org.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Manage {org.roomTerm}s
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {rooms.length} {org.roomTerm.toLowerCase()}
            {rooms.length !== 1 ? "s" : ""} configured
          </p>
        </div>
      </div>

      {/* Add Room Form */}
      <AddRoomForm organizationId={org.id} orgSlug={orgSlug} roomTerm={org.roomTerm} />

      {/* Rooms Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Icon
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                Mgr Only
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                Concurrent
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                Buffer
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
            {rooms.map((room) => (
              <RoomRow
                key={room.id}
                room={{
                  id: room.id,
                  name: room.name,
                  iconText: room.iconText,
                  active: room.active,
                  managersOnly: room.managersOnly,
                  concurrentEventLimit: room.concurrentEventLimit,
                  bufferMinutes: room.bufferMinutes,
                  capacity: room.capacity,
                  notes: room.notes,
                  sortOrder: room.sortOrder,
                  eventCount: room._count.events,
                  configurations: room.configurations.map((c) => ({
                    id: c.id,
                    name: c.name,
                    configurationTypeName: c.configurationType?.name || null,
                    configurationTypeId: c.configurationTypeId,
                    concurrentEventLimit: c.concurrentEventLimit,
                    eventCount: c._count.events,
                  })),
                }}
                configTypes={configTypes.map((ct) => ({ id: ct.id, name: ct.name }))}
                orgSlug={orgSlug}
              />
            ))}
          </tbody>
        </table>
        {rooms.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            No rooms configured. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}
