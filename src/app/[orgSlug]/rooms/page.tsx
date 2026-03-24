import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MapPin, Users, Check, X } from "lucide-react";

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
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {org.roomTerm} Information
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {rooms.length} {org.roomTerm.toLowerCase()}
          {rooms.length !== 1 ? "s" : ""} available for booking
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center justify-center w-10 h-10 bg-primary/10 text-primary rounded-lg text-sm font-bold">
                {room.iconText || room.name.charAt(0)}
              </span>
              <div>
                <h3 className="font-semibold text-slate-900">{room.name}</h3>
                {room.managersOnly && (
                  <span className="text-xs text-amber-600 font-medium">
                    Managers only
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <Users className="w-4 h-4" />
                <span>
                  Max concurrent events: {room.concurrentEventLimit}
                </span>
              </div>
              {room.notes && (
                <p className="text-slate-500 text-sm mt-2">{room.notes}</p>
              )}
            </div>
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
