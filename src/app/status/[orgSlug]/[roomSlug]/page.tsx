"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Clock,
  ArrowRight,
  Users,
  CalendarPlus,
  Loader2,
  Check,
  X,
} from "lucide-react";

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
  const [showBooking, setShowBooking] = useState(false);
  const [bookingState, setBookingState] = useState<
    "form" | "loading" | "success" | "error"
  >("form");
  const [bookingResult, setBookingResult] = useState<{
    title?: string;
    startTime?: string;
    endTime?: string;
    status?: string;
    error?: string;
  }>({});

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

  async function handleQuickBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBookingState("loading");

    const formData = new FormData(e.currentTarget);
    const body = {
      orgSlug: params.orgSlug,
      roomSlug: params.roomSlug,
      title: formData.get("title") as string,
      contactName: formData.get("contactName") as string,
      contactEmail: formData.get("contactEmail") as string,
      durationMinutes: parseInt(formData.get("duration") as string),
    };

    try {
      const res = await fetch("/api/rooms/quick-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();

      if (res.ok) {
        setBookingState("success");
        setBookingResult({
          title: result.event.title,
          startTime: new Date(result.event.startDateTime).toLocaleTimeString(
            [],
            { hour: "numeric", minute: "2-digit" }
          ),
          endTime: new Date(result.event.endDateTime).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
          status: result.event.requiresApproval ? "Pending Approval" : "Confirmed",
        });
        // Refresh status after a moment
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      } else {
        setBookingState("error");
        setBookingResult({ error: result.error });
      }
    } catch {
      setBookingState("error");
      setBookingResult({ error: "Network error. Please try again." });
    }
  }

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
        <div className="text-center mb-8">
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

        {/* Book Now button */}
        {isAvailable && !showBooking && (
          <button
            onClick={() => setShowBooking(true)}
            className="flex items-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/40 hover:-translate-y-0.5 active:translate-y-0 transition-all mb-8"
          >
            <CalendarPlus className="w-5 h-5" />
            Book Now
          </button>
        )}

        {/* Quick booking form */}
        {showBooking && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 max-w-md w-full mb-8">
            {bookingState === "form" && (
              <form onSubmit={handleQuickBook} className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                    Quick Book
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowBooking(false)}
                    className="text-white/30 hover:text-white/60 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <input
                  name="title"
                  required
                  placeholder="What's this for? (e.g., Team Meeting)"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/30 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    name="contactName"
                    required
                    placeholder="Your name"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/30 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                  <input
                    name="contactEmail"
                    type="email"
                    required
                    placeholder="Your email"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/30 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/40 mb-1.5">
                    Duration
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: 30, label: "30m" },
                      { value: 60, label: "1hr" },
                      { value: 90, label: "1.5hr" },
                      { value: 120, label: "2hr" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center justify-center px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-sm cursor-pointer hover:bg-white/10 has-[:checked]:bg-emerald-500/30 has-[:checked]:border-emerald-500 transition-colors"
                      >
                        <input
                          type="radio"
                          name="duration"
                          value={opt.value}
                          defaultChecked={opt.value === 60}
                          className="sr-only"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
                >
                  Confirm Booking
                </button>
              </form>
            )}

            {bookingState === "loading" && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
                <p className="text-white/60 text-sm">Booking your room...</p>
              </div>
            )}

            {bookingState === "success" && (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-lg font-bold text-white mb-1">Booked!</p>
                <p className="text-white/60 text-sm mb-1">
                  {bookingResult.title}
                </p>
                <p className="text-white/40 text-sm">
                  {bookingResult.startTime} – {bookingResult.endTime}
                </p>
                <p className="text-emerald-400 text-xs mt-2 font-medium">
                  {bookingResult.status}
                </p>
              </div>
            )}

            {bookingState === "error" && (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-6 h-6 text-red-400" />
                </div>
                <p className="text-lg font-bold text-white mb-1">
                  Booking Failed
                </p>
                <p className="text-red-400 text-sm mb-3">
                  {bookingResult.error}
                </p>
                <button
                  onClick={() => setBookingState("form")}
                  className="text-white/50 hover:text-white text-sm underline"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}

        {/* Current event details */}
        {room.currentEvent && (
          <div className="bg-white/5 border border-white/10 rounded-2xl px-8 py-6 max-w-lg w-full text-center mb-6">
            <p className="text-xs uppercase tracking-wider text-white/30 mb-2">
              Current {data.org.eventSingularTerm.toLowerCase()}
            </p>
            <p className="text-xl font-semibold">{room.currentEvent.title}</p>
            {room.currentEvent.organizer && (
              <p className="text-white/50 mt-1">
                {room.currentEvent.organizer}
              </p>
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
              Next:{" "}
              <span className="text-white/60 font-medium">
                {room.nextEvent.title}
              </span>
              {" at "}
              {new Date(room.nextEvent.startsAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        {isAvailable && !room.nextEvent && !showBooking && (
          <p className="text-white/30 text-sm">
            No more {data.org.eventSingularTerm.toLowerCase()}s scheduled today
          </p>
        )}

        {isAvailable && room.availableUntil && !showBooking && (
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
