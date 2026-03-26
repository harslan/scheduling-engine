"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Check, X } from "lucide-react";
import { formatTime } from "@/lib/format";

const SUCCESS_DISMISS_MS = 5_000;

interface QuickBookFormProps {
  orgSlug: string;
  roomSlug: string;
  onClose: () => void;
  onBooked: () => void;
}

export function QuickBookForm({
  orgSlug,
  roomSlug,
  onClose,
  onBooked,
}: QuickBookFormProps) {
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
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up auto-dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBookingState("loading");

    const formData = new FormData(e.currentTarget);
    const body = {
      orgSlug,
      roomSlug,
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
          startTime: formatTime(new Date(result.event.startDateTime)),
          endTime: formatTime(new Date(result.event.endDateTime)),
          status: result.event.requiresApproval
            ? "Pending Approval"
            : "Confirmed",
        });
        dismissTimerRef.current = setTimeout(() => {
          onClose();
          onBooked();
        }, SUCCESS_DISMISS_MS);
      } else {
        setBookingState("error");
        setBookingResult({ error: result.error });
      }
    } catch {
      setBookingState("error");
      setBookingResult({ error: "Network error. Please try again." });
    }
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-5 max-w-md w-full">
      {bookingState === "form" && (
        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-white/70 uppercase tracking-wider">
              Quick Book
            </p>
            <button
              type="button"
              onClick={onClose}
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
          <p className="text-white/60 text-sm mb-1">{bookingResult.title}</p>
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
          <p className="text-lg font-bold text-white mb-1">Booking Failed</p>
          <p className="text-red-400 text-sm mb-3">{bookingResult.error}</p>
          <button
            onClick={() => setBookingState("form")}
            className="text-white/50 hover:text-white text-sm underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
