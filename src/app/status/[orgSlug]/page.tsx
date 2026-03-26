"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Calendar, RefreshCw, Monitor, Users } from "lucide-react";

const REFRESH_INTERVAL_MS = 60_000;

interface RoomStatus {
  id: string;
  name: string;
  slug: string;
  iconText: string;
  capacity: number | null;
  status: "available" | "occupied" | "available_soon";
  availableUntil: string | null;
  availableIn: number | null;
  currentEvent: {
    title: string;
    endsAt: string;
    organizer: string | null;
  } | null;
  nextEvent: {
    title: string;
    startsAt: string;
    endsAt: string;
    organizer: string | null;
  } | null;
  todayEventCount: number;
}

interface StatusData {
  org: { name: string; roomTerm: string; eventSingularTerm: string };
  serverTime: string;
  rooms: RoomStatus[];
}

export default function StatusBoardPage() {
  const params = useParams<{ orgSlug: string }>();
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function fetchStatus() {
      try {
        const res = await fetch(`/api/rooms/status?org=${params.orgSlug}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
          setLastRefresh(new Date());
        }
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
    timer = setInterval(fetchStatus, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [params.orgSlug]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-slate-500 animate-spin" />
      </div>
    );
  }

  const available = data.rooms.filter((r) => r.status === "available");
  const occupied = data.rooms.filter((r) => r.status !== "available");

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center">
            <Calendar className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{data.org.name}</h1>
            <p className="text-xs text-slate-500">
              {data.org.roomTerm} Status Board
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-400">{available.length} available</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-slate-400">{occupied.length} in use</span>
            </span>
          </div>
          <Link
            href={`/${params.orgSlug}`}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            Back to calendar
          </Link>
        </div>
      </header>

      {/* Room Grid */}
      <main className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data.rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              orgSlug={params.orgSlug}
              eventTerm={data.org.eventSingularTerm}
            />
          ))}
        </div>

        {data.rooms.length === 0 && (
          <div className="text-center py-20">
            <Monitor className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 text-lg">
              No {data.org.roomTerm.toLowerCase()}s configured
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950/90 backdrop-blur-sm px-6 py-2 flex items-center justify-between text-xs text-slate-600">
        <span>
          Auto-refreshes every {REFRESH_INTERVAL_MS / 1000}s
          {lastRefresh && ` · Last updated ${formatTime(lastRefresh)}`}
        </span>
        <span>
          {formatTime(new Date(data.serverTime))}
        </span>
      </footer>
    </div>
  );
}

function RoomCard({
  room,
  orgSlug,
  eventTerm,
}: {
  room: RoomStatus;
  orgSlug: string;
  eventTerm: string;
}) {
  const isAvailable = room.status === "available";
  const isAvailableSoon = room.status === "available_soon";

  return (
    <Link
      href={`/status/${orgSlug}/${room.slug}`}
      className={`block rounded-2xl p-5 border transition-all hover:scale-[1.02] ${
        isAvailable
          ? "bg-emerald-950/50 border-emerald-800/50 hover:border-emerald-700"
          : isAvailableSoon
            ? "bg-amber-950/50 border-amber-800/50 hover:border-amber-700"
            : "bg-red-950/50 border-red-800/50 hover:border-red-700"
      }`}
    >
      {/* Room name + status dot */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-9 h-9 bg-white/10 rounded-lg text-sm font-bold">
            {room.iconText || room.name.charAt(0)}
          </span>
          <div>
            <h3 className="font-semibold text-white">{room.name}</h3>
            {room.capacity && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Users className="w-3 h-3" />
                {room.capacity}
              </span>
            )}
          </div>
        </div>
        <span
          className={`w-3.5 h-3.5 rounded-full ${
            isAvailable
              ? "bg-emerald-500 shadow-lg shadow-emerald-500/30"
              : isAvailableSoon
                ? "bg-amber-500 shadow-lg shadow-amber-500/30 animate-pulse"
                : "bg-red-500 shadow-lg shadow-red-500/30"
          }`}
        />
      </div>

      {/* Status details */}
      {isAvailable ? (
        <div>
          <p className="text-emerald-400 font-semibold text-sm">Available</p>
          {room.nextEvent ? (
            <p className="text-slate-500 text-xs mt-1">
              Until {formatTime(new Date(room.nextEvent.startsAt))}
              {" · "}
              Next: {room.nextEvent.title}
            </p>
          ) : (
            <p className="text-slate-600 text-xs mt-1">
              No more {eventTerm.toLowerCase()}s today
            </p>
          )}
        </div>
      ) : (
        <div>
          <p className={`font-semibold text-sm ${isAvailableSoon ? "text-amber-400" : "text-red-400"}`}>
            {isAvailableSoon ? `Free in ${room.availableIn}m` : "In Use"}
          </p>
          {room.currentEvent && (
            <p className="text-slate-400 text-xs mt-1 truncate">
              {room.currentEvent.title}
              {room.currentEvent.organizer && ` · ${room.currentEvent.organizer}`}
            </p>
          )}
          {room.currentEvent && (
            <p className="text-slate-600 text-xs mt-0.5">
              Until {formatTime(new Date(room.currentEvent.endsAt))}
              {room.availableIn && !isAvailableSoon && ` (${room.availableIn}m)`}
            </p>
          )}
        </div>
      )}

      {/* Today's event count */}
      {room.todayEventCount > 0 && (
        <p className="text-slate-600 text-[10px] mt-3 uppercase tracking-wider font-medium">
          {room.todayEventCount} {eventTerm.toLowerCase()}{room.todayEventCount !== 1 ? "s" : ""} today
        </p>
      )}
    </Link>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
