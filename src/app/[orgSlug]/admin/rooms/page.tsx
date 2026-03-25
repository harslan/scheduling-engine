import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Plus, Check, X, Search } from "lucide-react";
import { RoomRow } from "./room-row";
import { AddRoomForm } from "./add-room-form";

export default async function AdminRoomsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { orgSlug } = await params;
  const { q: searchQuery } = await searchParams;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  const nameFilter = searchQuery
    ? { name: { contains: searchQuery, mode: "insensitive" as const } }
    : {};

  const [rooms, configTypes] = await Promise.all([
    prisma.room.findMany({
      where: { organizationId: org.id, ...nameFilter },
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

      {/* Search */}
      <form method="GET" className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            name="q"
            type="search"
            defaultValue={searchQuery || ""}
            placeholder={`Search ${org.roomTerm.toLowerCase()}s...`}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
          />
          <button type="submit" className="sr-only">Search</button>
        </div>
      </form>

      {/* Add Room Form */}
      <AddRoomForm organizationId={org.id} orgSlug={orgSlug} roomTerm={org.roomTerm} />

      {/* Mobile: Room Cards */}
      <div className="md:hidden space-y-3">
        {rooms.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl py-12 text-center text-slate-400">
            No {org.roomTerm.toLowerCase()}s configured. Add one above.
          </div>
        )}
        {rooms.map((room) => {
          const roomData = {
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
          };
          return (
            <div key={room.id} className={`bg-white border border-slate-200 rounded-xl p-4 shadow-sm ${!room.active ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center justify-center w-9 h-7 bg-primary/10 text-primary rounded text-xs font-bold">
                    {room.iconText}
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">{room.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                      <span>{room._count.events} {org.eventPluralTerm.toLowerCase()}</span>
                      {room.bufferMinutes > 0 && <span>· {room.bufferMinutes}m buffer</span>}
                      {room.managersOnly && <span className="text-amber-600">· Managers only</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${room.active ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <span className="text-xs text-slate-400">{room.active ? "Active" : "Inactive"}</span>
                </div>
              </div>
              <div className="mt-3">
                <RoomRow
                  room={roomData}
                  configTypes={configTypes.map((ct) => ({ id: ct.id, name: ct.name }))}
                  orgSlug={orgSlug}
                  roomTerm={org.roomTerm}
                  mobileMode
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: Rooms Table */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Icon</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500" title="Active status">Active</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500" title="Managers only access">Managers Only</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500" title="Maximum concurrent events">Max Concurrent</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500" title="Buffer time between events">Buffer</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Events</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
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
                roomTerm={org.roomTerm}
              />
            ))}
          </tbody>
        </table>
        {rooms.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            No {org.roomTerm.toLowerCase()}s configured. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}
