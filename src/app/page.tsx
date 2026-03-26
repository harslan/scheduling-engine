import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  Calendar,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Check,
  Mail,
} from "lucide-react";
import {
  CALENDAR_TIMES_FULL,
  CALENDAR_EVENTS_FULL,
  CalendarGrid,
} from "@/components/calendar-mockup";

const getLandingStats = unstable_cache(
  async () => {
    const orgs = await prisma.organization.findMany({
      select: { slug: true, name: true, appDisplayName: true },
      take: 5,
    });
    return { orgs };
  },
  ["landing-orgs"],
  { revalidate: 300 }
);

export default async function Home() {
  // If user is signed in, redirect to their org
  const session = await getSession();
  if (session?.user) {
    const userId = (session.user as { id: string }).id;
    const membership = await prisma.organizationMember.findFirst({
      where: { userId },
      select: { organization: { select: { slug: true } } },
    });
    if (membership) {
      redirect(`/${membership.organization.slug}`);
    }
  }

  const { orgs } = await getLandingStats();

  return (
    <div className="min-h-full bg-white overflow-hidden">
      {/* ========== HEADER ========== */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -inset-1 bg-primary/20 rounded-xl blur-md -z-10" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              Scheduling Engine
            </span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-4 py-2"
            >
              Sign in
            </Link>
            {orgs.length > 0 && (
              <Link
                href={`/${orgs[0].slug}`}
                className="text-sm font-semibold bg-gradient-to-r from-primary to-blue-600 text-white px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all"
              >
                View Demo
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* ========== HERO ========== */}
      <section className="relative hero-mesh">
        <div className="absolute inset-0 hero-grid opacity-40" />

        <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-16 lg:pt-32 lg:pb-20">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="animate-fade-in-up inline-flex items-center gap-2.5 bg-white/80 backdrop-blur-sm text-primary text-sm font-semibold px-5 py-2 rounded-full border border-primary/15 shadow-sm mb-10">
              <div className="relative flex items-center justify-center">
                <Sparkles className="w-4 h-4 relative z-10" />
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
              </div>
              Built for enterprise scheduling
            </div>

            {/* Headline */}
            <h1 className="animate-fade-in-up-delay-1 text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.05]">
              Manage every room.
              <br />
              <span className="bg-gradient-to-r from-primary via-blue-600 to-indigo-600 bg-clip-text text-transparent animate-gradient-shift">
                Automate every booking.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="animate-fade-in-up-delay-2 mt-8 text-xl lg:text-2xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-light">
              One platform for rooms, events, and approvals.
              <span className="text-slate-700 font-normal"> AI assistant included.</span>
            </p>

            {/* CTA Buttons */}
            <div className="animate-fade-in-up-delay-3 mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              {orgs.length > 0 && (
                <Link
                  href={`/${orgs[0].slug}`}
                  className="group relative bg-gradient-to-r from-primary to-blue-600 text-white px-10 py-4 rounded-2xl text-lg font-semibold hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-1 transition-all flex items-center gap-3 overflow-hidden"
                >
                  <span className="absolute inset-0 animate-shimmer" />
                  <span className="relative">Explore the Demo</span>
                  <ArrowRight className="w-5 h-5 relative group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
              <Link
                href="/login"
                className="group bg-white border-2 border-slate-200 text-slate-700 px-10 py-4 rounded-2xl text-lg font-semibold hover:border-primary/30 hover:bg-primary/5 hover:-translate-y-1 transition-all flex items-center gap-2"
              >
                Sign In
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>

          {/* Product Preview — Browser chrome + weekly calendar */}
          <div className="animate-fade-in-up-delay-4 mt-16 max-w-4xl mx-auto hidden sm:block">
            <div className="rounded-xl overflow-hidden shadow-2xl shadow-slate-300/50 border border-slate-200/80 bg-white">
              {/* Browser toolbar */}
              <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-slate-300" />
                  <div className="w-3 h-3 rounded-full bg-slate-300" />
                  <div className="w-3 h-3 rounded-full bg-slate-300" />
                </div>
                <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-slate-400 border border-slate-200">
                  scheduling-engine.app/acme-corp
                </div>
              </div>

              {/* Calendar mockup */}
              <div className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs sm:text-sm font-semibold text-slate-700">March 2026</div>
                  <div className="flex gap-1">
                    <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded">Month</span>
                    <span className="text-[10px] font-medium text-white bg-primary px-2 py-0.5 rounded">Week</span>
                    <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded">Day</span>
                  </div>
                </div>
                <CalendarGrid times={CALENDAR_TIMES_FULL} events={CALENDAR_EVENTS_FULL} />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60V20C240 45 480 55 720 45C960 35 1200 15 1440 25V60H0Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ========== DIFFERENTIATORS ========== */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6">

          {/* — AI-Powered Booking — */}
          <div className="py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mb-5">
                Book with a conversation
              </h2>
              <p className="text-lg text-slate-500 leading-relaxed">
                Describe what you need in plain language. The AI assistant checks availability,
                picks the right room, and creates the booking — no forms, no searching.
              </p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80">
              {/* Chat mockup */}
              <div className="space-y-3">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="bg-primary text-white text-sm rounded-2xl rounded-br-md px-4 py-2.5 max-w-[300px] shadow-sm">
                    Book Conference Room A for tomorrow at 2 PM
                  </div>
                </div>
                {/* AI response */}
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 text-sm rounded-2xl rounded-bl-md px-4 py-3 max-w-[340px] shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center mt-0.5 shrink-0">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">Booked Conference Room A</p>
                        <p className="text-slate-500 mt-0.5">March 26, 2:00 – 3:00 PM</p>
                        <p className="text-slate-400 text-xs mt-1.5">Confirmation sent to your email</p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Follow-up */}
                <div className="flex justify-end">
                  <div className="bg-primary text-white text-sm rounded-2xl rounded-br-md px-4 py-2.5 max-w-[300px] shadow-sm">
                    Make it recurring, every Tuesday
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 text-sm rounded-2xl rounded-bl-md px-4 py-3 max-w-[340px] shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center mt-0.5 shrink-0">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </div>
                      <p className="font-medium text-slate-800 mt-0.5">Done — repeats every Tue, 2:00 – 3:00 PM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* — Approval Workflows — */}
          <div className="py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="order-2 lg:order-1 bg-slate-50 rounded-2xl p-6 border border-slate-200/80">
              {/* Approval flow mockup */}
              <div className="space-y-0">
                {[
                  { label: "Submitted", sublabel: "Booking request created", dotBg: "bg-primary", textColor: "text-primary" },
                  { label: "Under Review", sublabel: "Waiting for manager approval", dotBg: "bg-amber-500", textColor: "text-amber-600" },
                  { label: "Approved", sublabel: "Confirmed & calendar synced", dotBg: "bg-emerald-500", textColor: "text-emerald-600" },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 ${step.dotBg} rounded-full flex items-center justify-center shadow-sm`}>
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      {i < 2 && <div className="w-0.5 h-12 bg-slate-200" />}
                    </div>
                    <div className="pt-1 pb-4">
                      <p className={`font-semibold text-sm ${step.textColor}`}>{step.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{step.sublabel}</p>
                      {i === 0 && (
                        <div className="mt-2 inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 py-1 text-[11px] text-slate-500 shadow-sm">
                          <Mail className="w-3 h-3" />
                          Notification sent to manager
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mb-5">
                Every booking, accounted for
              </h2>
              <p className="text-lg text-slate-500 leading-relaxed">
                Route bookings through configurable approval chains. Managers get notified instantly,
                approve with one click, and every decision is logged in a complete audit trail.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* — Multi-Org & White-Label — */}
          <div className="py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight mb-5">
                Your platform, your language
              </h2>
              <p className="text-lg text-slate-500 leading-relaxed">
                Run multiple organizations from one deployment. Each gets its own rooms, rules, branding,
                and terminology — &ldquo;Rooms&rdquo; or &ldquo;Studios,&rdquo; &ldquo;Events&rdquo; or &ldquo;Sessions.&rdquo; Your call.
              </p>
            </div>
            <div>
              {/* Side-by-side org config cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <p className="font-bold text-slate-900 text-sm">Acme Corp</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Spaces</span>
                      <span className="font-semibold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5">Rooms</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Bookings</span>
                      <span className="font-semibold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5">Events</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Color</span>
                      <div className="flex gap-1">
                        <div className="w-3.5 h-3.5 rounded-full bg-primary border border-primary/20" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80">
                  <div className="w-8 h-8 bg-violet-500/10 rounded-lg flex items-center justify-center mb-3">
                    <Calendar className="w-4 h-4 text-violet-600" />
                  </div>
                  <p className="font-bold text-slate-900 text-sm">Studio Co</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Spaces</span>
                      <span className="font-semibold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5">Studios</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Bookings</span>
                      <span className="font-semibold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5">Sessions</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Color</span>
                      <div className="flex gap-1">
                        <div className="w-3.5 h-3.5 rounded-full bg-violet-500 border border-violet-500/20" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== EVERYTHING BUILT IN ========== */}
      <section className="bg-slate-50 border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight text-center mb-12">
            Everything built in
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4">
            {[
              "Multi-view calendar",
              "Role-based access control",
              "iCal & calendar sync",
              "Email notifications",
              "Analytics & CSV export",
              "Scheduling rules & buffers",
              "Room configurations",
              "Concurrent booking limits",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 py-1.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-sm font-medium text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CTA ========== */}
      {orgs.length > 0 && (
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-blue-600 to-indigo-700" />
          <div className="absolute inset-0 hero-grid opacity-10" />

          <div className="relative max-w-7xl mx-auto px-6 py-20 text-center">
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
              See it in action
            </h2>
            <p className="text-blue-100 text-xl mb-10 max-w-xl mx-auto">
              Explore a live deployment with rooms, calendars, approvals, and the AI booking assistant.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {orgs.map((org) => (
                <Link
                  key={org.slug}
                  href={`/${org.slug}`}
                  className="group bg-white/10 backdrop-blur-sm text-white border border-white/20 px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-white/20 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/20 transition-all flex items-center gap-3"
                >
                  {org.appDisplayName || org.name}
                  <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========== FOOTER ========== */}
      <footer className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center">
                <Calendar className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                Scheduling Engine
              </span>
            </div>
            <div className="flex items-center gap-8 text-sm text-slate-400">
              <Link href="/login" className="hover:text-white transition-colors">
                Sign In
              </Link>
              {orgs.length > 0 && (
                <Link href={`/${orgs[0].slug}`} className="hover:text-white transition-colors">
                  Demo
                </Link>
              )}
            </div>
            <p className="text-sm text-slate-500">
              Modern room scheduling for the AI era.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

