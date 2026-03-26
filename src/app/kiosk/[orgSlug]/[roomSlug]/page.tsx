"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Clock,
  CalendarPlus,
  Maximize,
  Users,
  WifiOff,
} from "lucide-react";
import { QuickBookForm } from "@/components/quick-book-form";
import { formatTime } from "@/lib/format";

const REFRESH_INTERVAL_MS = 15_000;
const IDLE_TIMEOUT_MS = 45_000;
const STALE_THRESHOLD_MS = REFRESH_INTERVAL_MS * 3;

interface TodayEvent {
  title: string;
  startsAt: string;
  endsAt: string;
}

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
  todayEvents: TodayEvent[];
}

interface StatusData {
  org: { name: string; roomTerm: string; eventSingularTerm: string };
  serverTime: string;
  rooms: RoomStatus[];
}

export default function KioskPage() {
  const params = useParams<{ orgSlug: string; roomSlug: string }>();
  const [data, setData] = useState<StatusData | null>(null);
  const [now, setNow] = useState(new Date());
  const [showBooking, setShowBooking] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch status data
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/rooms/status?org=${params.orgSlug}&room=${params.roomSlug}`
      );
      if (res.ok) {
        setData(await res.json());
        setLastFetchTime(new Date());
      }
    } catch {
      // Retry on next interval
    }
  }, [params.orgSlug, params.roomSlug]);

  // Auto-refresh + live clock
  useEffect(() => {
    fetchStatus();
    const fetchTimer = setInterval(fetchStatus, REFRESH_INTERVAL_MS);
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(fetchTimer);
      clearInterval(clockTimer);
    };
  }, [fetchStatus]);

  // Online/offline detection — fetch immediately on reconnect
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      fetchStatus();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchStatus]);

  // Wake Lock — keep tablet screen on
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Wake lock may fail if page not visible
      }
    }

    requestWakeLock();

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      wakeLock?.release();
    };
  }, []);

  // Idle timeout — dismiss booking form after 45s of no touch
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setShowBooking(false);
    }, IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (!showBooking) return;
    resetIdleTimer();

    const events = ["touchstart", "mousedown", "keydown"] as const;
    events.forEach((e) => document.addEventListener(e, resetIdleTimer));
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach((e) => document.removeEventListener(e, resetIdleTimer));
    };
  }, [showBooking, resetIdleTimer]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  // Stale data check — re-evaluated every 1s clock tick via `now`
  const isStale =
    lastFetchTime !== null &&
    now.getTime() - lastFetchTime.getTime() > STALE_THRESHOLD_MS;

  // Loading state
  if (!data || data.rooms.length === 0) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center">
          <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-500 text-xl">Loading room status...</p>
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

  const dotClass = isAvailable
    ? "bg-emerald-500 shadow-emerald-500/40"
    : isAvailableSoon
      ? "bg-amber-500 shadow-amber-500/40 animate-pulse"
      : "bg-red-500 shadow-red-500/40";

  const statusLabel = isAvailable
    ? "AVAILABLE"
    : isAvailableSoon
      ? `Available in ${room.availableIn} min`
      : "IN USE";

  const statusDetail = isAvailable
    ? room.availableUntil
      ? `Available until ${formatTime(new Date(room.availableUntil))}`
      : "Free for the rest of the day"
    : room.currentEvent
      ? `Ends at ${formatTime(new Date(room.currentEvent.endsAt))}`
      : null;

  // Timeline: filter out past events, show current + upcoming only
  const allTodayEvents = room.todayEvents ?? [];
  const pastEventCount = allTodayEvents.filter(
    (evt) => new Date(evt.endsAt) <= now
  ).length;
  const visibleEvents = allTodayEvents.filter(
    (evt) => new Date(evt.endsAt) > now
  );

  return (
    <div
      className={`h-screen ${bgClass} text-white flex flex-col overflow-hidden select-none`}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 shrink-0">
        <div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
            {room.name}
          </h1>
          {room.capacity && (
            <p className="flex items-center gap-1.5 text-white/40 mt-0.5 text-sm">
              <Users className="w-4 h-4" />
              {room.capacity} seats
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-3xl lg:text-4xl font-light tabular-nums text-white/80">
            {formatTime(now)}
          </p>
          <p className="text-sm text-white/30 mt-0.5">
            {now.toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </header>

      {/* Stale/offline banner */}
      {(!isOnline || isStale) && (
        <div className="flex items-center justify-center gap-2 bg-amber-600/80 text-white text-sm py-1.5 px-4 shrink-0">
          <WifiOff className="w-4 h-4" />
          {!isOnline
            ? "Offline — showing last known status"
            : "Connection issues — data may be stale"}
        </div>
      )}

      {/* Main content — portrait stacks, landscape side-by-side */}
      <main className="flex-1 flex flex-col landscape:flex-row lg:flex-row min-h-0">
        {/* Left: Status + booking */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          {/* Status indicator */}
          <div
            className={`w-6 h-6 rounded-full shadow-lg mb-4 ${dotClass}`}
          />
          <p className={`text-4xl lg:text-5xl font-extrabold ${accentClass}`}>
            {statusLabel}
          </p>
          {statusDetail && (
            <p className="text-white/40 text-lg mt-2">{statusDetail}</p>
          )}

          {/* Current event info */}
          {room.currentEvent && (
            <div className="mt-4 text-center">
              <p className="text-white/60 text-lg">
                {room.currentEvent.title}
              </p>
              {room.currentEvent.organizer && (
                <p className="text-white/30 text-sm">
                  {room.currentEvent.organizer}
                </p>
              )}
            </div>
          )}

          {/* Book Now button */}
          {isAvailable && !showBooking && (
            <button
              onClick={() => setShowBooking(true)}
              className="flex items-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-white px-10 py-5 rounded-2xl text-xl font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/40 hover:-translate-y-0.5 active:translate-y-0 transition-all mt-8"
            >
              <CalendarPlus className="w-6 h-6" />
              Book Now
            </button>
          )}

          {/* Quick booking form */}
          {showBooking && (
            <div className="mt-6">
              <QuickBookForm
                orgSlug={params.orgSlug}
                roomSlug={params.roomSlug}
                onClose={() => setShowBooking(false)}
                onBooked={fetchStatus}
              />
            </div>
          )}
        </div>

        {/* Right: Today's timeline */}
        <aside className="w-full landscape:w-72 lg:w-80 max-h-[30vh] landscape:max-h-none lg:max-h-none border-t landscape:border-t-0 landscape:border-l lg:border-t-0 lg:border-l border-white/10 px-5 py-4 flex flex-col shrink-0">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
            Today&apos;s Schedule
          </h2>
          <div className="flex-1 overflow-hidden space-y-1 pr-1">
            {pastEventCount > 0 && (
              <p className="text-white/20 text-xs mb-1">
                {pastEventCount} earlier event{pastEventCount !== 1 ? "s" : ""}
              </p>
            )}
            {visibleEvents.length === 0 && pastEventCount === 0 ? (
              <p className="text-white/20 text-sm">No events today</p>
            ) : visibleEvents.length === 0 ? (
              <p className="text-white/20 text-sm">No more events today</p>
            ) : (
              visibleEvents.map((evt, i) => {
                const start = new Date(evt.startsAt);
                const end = new Date(evt.endsAt);
                const isCurrent = start <= now && end > now;

                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${
                      isCurrent
                        ? "bg-white/10 border border-white/20"
                        : ""
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          isCurrent
                            ? `${dotClass} shadow-lg`
                            : "bg-white/30"
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white/50 tabular-nums">
                        {formatTime(start)} – {formatTime(end)}
                      </p>
                      <p
                        className={`text-sm font-medium truncate ${
                          isCurrent ? "text-white" : "text-white/70"
                        }`}
                      >
                        {evt.title}
                      </p>
                      {isCurrent && (
                        <p className={`text-xs font-semibold mt-0.5 ${accentClass}`}>
                          NOW
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="px-8 py-2.5 flex items-center justify-between text-xs text-white/20 shrink-0 border-t border-white/5">
        <span>{data.org.name}</span>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors"
          >
            <Maximize className="w-3.5 h-3.5" />
            Fullscreen
          </button>
          <span>Auto-refreshes {REFRESH_INTERVAL_MS / 1000}s</span>
        </div>
      </footer>
    </div>
  );
}
