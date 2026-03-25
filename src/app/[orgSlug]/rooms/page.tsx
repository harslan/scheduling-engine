import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MapPin, Users, Clock, Layers, Shield } from "lucide-react";

export default async function RoomInfoPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  const rooms = await prisma.room.findMany({
    where: { organizationId: org.id, active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      configurations: {
        include: { configurationType: true },
      },
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          {org.roomTerm} Information
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {rooms.length} {org.roomTerm.toLowerCase()}
          {rooms.length !== 1 ? "s" : ""} available for booking
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="p-5 pb-3">
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-xl text-lg font-bold">
                  {room.iconText || room.name.charAt(0)}
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{room.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {room.capacity && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Capacity: {room.capacity}
                      </span>
                    )}
                    {room.managersOnly && (
                      <span className="flex items-center gap-1 text-amber-500">
                        <Shield className="w-3 h-3" />
                        Managers only
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {room.notes && (
                <p className="text-sm text-slate-500 mb-3">{room.notes}</p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  Max {room.concurrentEventLimit} concurrent
                </span>
                {room.bufferMinutes > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {room.bufferMinutes}min buffer
                  </span>
                )}
              </div>
            </div>

            {/* Configurations */}
            {room.configurations.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/50">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Available Configurations
                </p>
                <div className="flex flex-wrap gap-2">
                  {room.configurations.map((config) => (
                    <span
                      key={config.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600"
                    >
                      {config.name}
                      {config.configurationType && (
                        <span className="text-slate-400">
                          · {config.configurationType.name}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {rooms.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">
            No {org.roomTerm.toLowerCase()}s configured yet
          </p>
        </div>
      )}
    </div>
  );
}
