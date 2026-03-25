"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { Suspense, Fragment } from "react";

/* ===== Calendar mockup — same data as landing page ===== */

const CALENDAR_DAYS = ["Mon 23", "Tue 24", "Wed 25", "Thu 26", "Fri 27"];
const CALENDAR_TIMES = ["9 AM", "10 AM", "11 AM", "12 PM"];

type CalendarEvent = {
  row: number;
  col: number;
  span: number;
  label: string;
  room: string;
  variant: "primary" | "emerald" | "amber";
};

const CALENDAR_EVENTS: CalendarEvent[] = [
  { row: 0, col: 0, span: 1, label: "Team Standup", room: "Room A", variant: "primary" },
  { row: 1, col: 1, span: 2, label: "Design Review", room: "Room B", variant: "emerald" },
  { row: 3, col: 2, span: 1, label: "Pending Review", room: "Room C", variant: "amber" },
  { row: 2, col: 4, span: 1, label: "1:1 Meeting", room: "Room B", variant: "emerald" },
];

const EVENT_STYLES = {
  primary: { bg: "bg-primary/15", border: "border-primary", text: "text-primary", sub: "text-primary/60" },
  emerald: { bg: "bg-emerald-500/15", border: "border-emerald-500", text: "text-emerald-700", sub: "text-emerald-600/60" },
  amber: { bg: "bg-amber-500/15", border: "border-amber-500", text: "text-amber-700", sub: "text-amber-600/60" },
};

function CalendarEventBlock({ event }: { event: CalendarEvent }) {
  const s = EVENT_STYLES[event.variant];
  const height = event.span > 1 ? `calc(${event.span * 100}% + ${(event.span - 1) * 1}px)` : undefined;
  return (
    <div
      className={`absolute inset-x-0.5 top-0.5 ${s.bg} border-l-2 ${s.border} rounded-r-sm px-1 py-0.5 overflow-hidden`}
      style={height ? { height, zIndex: 1 } : undefined}
    >
      <span className={`font-medium ${s.text} leading-tight block truncate`}>{event.label}</span>
      <span className={`${s.sub} truncate block`}>{event.room}</span>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header — matches landing page */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -inset-1 bg-primary/20 rounded-xl blur-md -z-10" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              Scheduling Engine
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </header>

      {/* Main — hero-mesh background */}
      <main className="flex-1 relative hero-mesh">
        <div className="absolute inset-0 hero-grid opacity-20" />

        <div className="relative max-w-7xl mx-auto px-6 pt-12 sm:pt-20 pb-16">
          <div className="max-w-[420px] mx-auto">
            {/* Heading */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Sign in to your account
              </h1>
              <p className="text-slate-500 mt-2">
                Enter your credentials to continue
              </p>
            </div>

            {/* Form card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-7 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    {error}
                  </div>
                )}

                {/* Email */}
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      autoFocus
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all text-sm placeholder:text-slate-400"
                      placeholder="you@company.com"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-primary hover:text-primary-dark font-medium transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      className="w-full pl-10 pr-11 py-2.5 border border-slate-200 rounded-xl bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all text-sm placeholder:text-slate-400"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-blue-600 text-white py-3 rounded-2xl text-sm font-semibold hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Help text */}
            <p className="mt-6 text-center text-sm text-slate-400">
              Need access?{" "}
              <span className="text-slate-500">
                Contact your organization administrator
              </span>
            </p>
          </div>

          {/* Product preview — echoes the landing page mockup */}
          <div className="hidden sm:block mt-16 max-w-2xl mx-auto">
            <div className="relative">
              {/* Fade-out gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#f0f4fa] via-transparent to-transparent z-10 rounded-xl" />

              <div className="rounded-xl overflow-hidden shadow-lg shadow-slate-200/50 border border-slate-200/80 bg-white opacity-80">
                {/* Browser toolbar */}
                <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  </div>
                  <div className="flex-1 bg-white rounded-md px-3 py-0.5 text-[10px] text-slate-400 border border-slate-200">
                    scheduling-engine.app/acme-corp
                  </div>
                </div>

                {/* Calendar mockup */}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-slate-700">March 2026</div>
                    <div className="flex gap-1">
                      <span className="text-[9px] font-medium text-slate-400 px-1.5 py-0.5 rounded">Month</span>
                      <span className="text-[9px] font-medium text-white bg-primary px-1.5 py-0.5 rounded">Week</span>
                      <span className="text-[9px] font-medium text-slate-400 px-1.5 py-0.5 rounded">Day</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-[36px_repeat(5,1fr)] gap-px bg-slate-100 rounded-lg overflow-hidden text-[9px]">
                    <div className="bg-white p-1" />
                    {CALENDAR_DAYS.map((day) => (
                      <div key={day} className="bg-slate-50 p-1 text-center font-medium text-slate-500">
                        {day}
                      </div>
                    ))}
                    {CALENDAR_TIMES.map((time, rowIdx) => (
                      <Fragment key={time}>
                        <div className="bg-white p-1 text-right text-slate-400 pr-1.5">
                          {time}
                        </div>
                        {CALENDAR_DAYS.map((_, colIdx) => {
                          const event = CALENDAR_EVENTS.find((e) => e.row === rowIdx && e.col === colIdx);
                          return (
                            <div key={colIdx} className="bg-white p-0.5 min-h-[24px] relative">
                              {event && <CalendarEventBlock event={event} />}
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
