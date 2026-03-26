"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Clock, ArrowRight, Users } from "lucide-react";

const REFRESH_INTERVAL_MS = 30_000;

interface RoomStatus {
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

export default function RoomDisplayPage() {
  const params = useParams<{ orgSlug: string; roomSlug: string }>();
  const [data, setData] = useState<StatusData | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let fetchTimer: ReturnType<typeof setInterval>;
    let clockTimer: ReturnType<typeof setInterval>;

    async function fetchStatus() {
      try {
        const res = await fetch(
          `/api/rooms/status?org=${params.orgSlug}&room=${params.roomSlug}`
        );
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // Silently retry on next interval
      }
    }

    fetchStatus();
    fetchTimer = setInterval(fetchStatus, REFRESH_INTERVAL_MS);
    clockTimer = setInterval(() => setNow(new Date()), 1000);

    return () => {
      clearInterval(fetchTimer);
      clearInterval(clockTimer);
    };
  }, [params.orgSlug, params.roomSlug]);

  if (!data || data.rooms.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-500 text-lg">Loading room status...</p>
        </div>
      </div>
    );
  }

  const room = data.rooms[0];
  const isAvailable = room.status === "available";
  const isAvailableSoon = room.status === "available_soon";

  const bgClass = isAvailable
    ? "bg-emerald-950"
    : isAvailableSoon
      ? "bg-amber-950"
      : "bg-red-950";

  const accentClass = isAvailable
    ? "text-emerald-400"
    : isAvailableSoon
      ? "text-amber-400"
      : "text-red-400";

  const statusLabel = isAvailable
    ? "Available"
    : isAvailableSoon
      ? `Available in ${room.availableIn} min`
      : "In Use";

  return (
    <div className={`min-h-screen ${bgClass} text-white flex flex-col`}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-5 shrink-0">
        <Link
          href={`/status/${params.orgSlug}`}
          className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          All {data.org.roomTerm.toLowerCase()}s
        </Link>
        <div className="text-right">
          <p className="text-2xl font-light tabular-nums text-white/80">
            {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="text-xs text-white/30 mt-0.5">
            {now.toLocaleDateString([], {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </header>

      {/* Main content — centered */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 pb-16">
        {/* Room name */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl text-2xl font-bold mb-4">
            {room.iconText || room.name.charAt(0)}
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            {room.name}
          </h1>
          {room.capacity && (
            <p className="flex items-center justify-center gap-1.5 text-white/40 mt-2 text-sm">
              <Users className="w-4 h-4" />
              Capacity: {room.capacity}
            </p>
          )}
        </div>

        {/* Status indicator */}
        <div className="text-center mb-12">
          <div
            className={`inline-flex w-5 h-5 rounded-full mb-4 ${
              isAvailable
                ? "bg-emerald-500 shadow-lg shadow-emerald-500/40"
                : isAvailableSoon
                  ? "bg-amber-500 shadow-lg shadow-amber-500/40 animate-pulse"
                  : "bg-red-500 shadow-lg shadow-red-500/40"
            }`}
          />
          <p className={`text-3xl sm:text-4xl font-bold ${accentClass}`}>
            {statusLabel}
          </p>
        </div>

        {/* Current event details */}
        {room.currentEvent && (
          <div className="bg-white/5 border border-white/10 rounded-2xl px-8 py-6 max-w-lg w-full text-center mb-6">
            <p className="text-xs uppercase tracking-wider text-white/30 mb-2">
              Current {data.org.eventSingularTerm.toLowerCase()}
            </p>
            <p className="text-xl font-semibold">{room.currentEvent.title}</p>
            {room.currentEvent.organizer && (
              <p className="text-white/50 mt-1">{room.currentEvent.organizer}</p>
            )}
            <p className="text-white/40 text-sm mt-2">
              Ends at{" "}
              {new Date(room.currentEvent.endsAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}

        {/* Next event */}
        {room.nextEvent && (
          <div className="flex items-center gap-3 text-white/40 text-sm">
            <ArrowRight className="w-4 h-4" />
            <span>
              Next: <span className="text-white/60 font-medium">{room.nextEvent.title}</span>
              {" at "}
              {new Date(room.nextEvent.startsAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        {isAvailable && !room.nextEvent && (
          <p className="text-white/30 text-sm">
            No more {data.org.eventSingularTerm.toLowerCase()}s scheduled today
          </p>
        )}

        {isAvailable && room.availableUntil && (
          <p className="text-white/40 text-sm mt-2">
            Available until{" "}
            {new Date(room.availableUntil).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
      </main>

      {/* Footer */}
      <footer className="px-8 py-3 text-center text-xs text-white/20 shrink-0">
        {data.org.name} · Refreshes every {REFRESH_INTERVAL_MS / 1000}s
      </footer>
    </div>
  );
}
