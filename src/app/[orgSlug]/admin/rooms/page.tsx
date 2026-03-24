import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Plus, Edit, Check, X } from "lucide-react";

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

  const rooms = await prisma.room.findMany({
    where: { organizationId: org.id },
    orderBy: { sortOrder: "asc" },
  });

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
        <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors">
          <Plus className="w-4 h-4" />
          Add {org.roomTerm}
        </button>
      </div>

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
                Managers Only
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                Capacity
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr
                key={room.id}
                className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  {room.name}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center justify-center w-8 h-6 bg-primary/10 text-primary rounded text-xs font-bold">
                    {room.iconText}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {room.active ? (
                    <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                  ) : (
                    <X className="w-4 h-4 text-slate-300 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {room.managersOnly ? (
                    <Check className="w-4 h-4 text-amber-500 mx-auto" />
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-sm text-slate-600">
                  {room.concurrentEventLimit}
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
