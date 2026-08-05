import Link from "next/link";
import { ROOM_COLORS } from "./calendar-constants";
import { RoomSelect } from "./room-select";

type Room = { id: string; name: string };
type EventType = { id: string; name: string; colorIndex: number | null };

export function CalendarFilters({
  orgSlug,
  rooms,
  eventTypes,
  activeRoomFilter,
  activeEventTypes,
  eventCountByRoom,
  roomlessEventCount,
  eventCountByType,
  allowsRoomlessEvents,
  roomColorMap,
  roomTerm,
  buildUrl,
}: {
  orgSlug: string;
  rooms: Room[];
  eventTypes: EventType[];
  activeRoomFilter: string;
  activeEventTypes: string[];
  eventCountByRoom: Map<string, number>;
  roomlessEventCount: number;
  eventCountByType: Map<string, number>;
  allowsRoomlessEvents: boolean;
  roomColorMap: Map<string, number>;
  roomTerm: string;
  buildUrl: (overrides: { room?: string; eventType?: string }) => string;
}) {
  const hasRooms = rooms.length > 0;
  const hasEventTypes = eventTypes.length > 0;

  if (!hasRooms && !hasEventTypes) return null;

  // Past a dozen rooms, pills become a wall — collapse to a select.
  const manyRooms = rooms.length > 12;
  const roomOptions = manyRooms
    ? [
        {
          href: buildUrl({ room: "all" }),
          label: `All ${roomTerm}s`,
          active: activeRoomFilter === "all",
        },
        ...rooms.map((room) => {
          const count = eventCountByRoom.get(room.id) ?? 0;
          return {
            href: buildUrl({ room: room.id }),
            label: count > 0 ? `${room.name} (${count})` : room.name,
            active: activeRoomFilter === room.id,
          };
        }),
        ...(allowsRoomlessEvents
          ? [
              {
                href: buildUrl({ room: "none" }),
                label: `No ${roomTerm}`,
                active: activeRoomFilter === "none",
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="mb-4 space-y-2">
      {manyRooms && (
        <RoomSelect
          options={roomOptions}
          activeHref={roomOptions.find((o) => o.active)?.href ?? roomOptions[0].href}
          roomTerm={roomTerm}
        />
      )}
      {/* Room filter pills */}
      {hasRooms && !manyRooms && (
        <div className="flex flex-nowrap md:flex-wrap gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {/* All pill */}
          <Link
            href={buildUrl({ room: "all" })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
              activeRoomFilter === "all"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            All {roomTerm}s
          </Link>

          {/* Room pills */}
          {rooms.map((room) => {
            const colorIdx = roomColorMap.get(room.id) ?? 0;
            const color = ROOM_COLORS[colorIdx];
            const count = eventCountByRoom.get(room.id) ?? 0;
            const isActive = activeRoomFilter === room.id;

            return (
              <Link
                key={room.id}
                href={buildUrl({ room: room.id })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                  isActive
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? "bg-white/80" : color.solid}`} />
                {room.name}
                {count > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-semibold ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}

          {/* No Room pill */}
          {allowsRoomlessEvents && (
            <Link
              href={buildUrl({ room: "none" })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                activeRoomFilter === "none"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${activeRoomFilter === "none" ? "bg-white/80" : "bg-slate-300"}`} />
              No {roomTerm}
              {roomlessEventCount > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-semibold ${
                  activeRoomFilter === "none" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {roomlessEventCount}
                </span>
              )}
            </Link>
          )}
        </div>
      )}

      {/* Event type filter pills (multi-select) */}
      {hasEventTypes && (
        <div className="flex flex-nowrap md:flex-wrap gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {eventTypes.map((et) => {
            const isActive = activeEventTypes.includes(et.id);
            const count = eventCountByType.get(et.id) ?? 0;

            // Toggle: add or remove this ID from the active list
            const newTypes = isActive
              ? activeEventTypes.filter((id) => id !== et.id)
              : [...activeEventTypes, et.id];
            const eventTypeParam = newTypes.length > 0 ? newTypes.join(",") : "";

            return (
              <Link
                key={et.id}
                href={buildUrl({ eventType: eventTypeParam })}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                  isActive
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {et.name}
                {count > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-semibold ${
                    isActive ? "bg-primary/20 text-primary" : "bg-slate-100 text-slate-500"
                  }`}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
