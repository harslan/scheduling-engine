import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import {
  Calendar,
  Building2,
  Zap,
  Shield,
  MessageSquare,
  Globe,
  ArrowRight,
  Sparkles,
  Clock,
  Users,
  BarChart3,
  Lock,
  Layers,
  ChevronRight,
  Star,
  CheckCircle2,
} from "lucide-react";

const getLandingStats = unstable_cache(
  async () => {
    const [orgs, totalEvents, totalOrgs, totalRooms] = await Promise.all([
      prisma.organization.findMany({
        select: { slug: true, name: true, appDisplayName: true },
        take: 5,
      }),
      prisma.event.count({ where: { deleted: false } }),
      prisma.organization.count(),
      prisma.room.count(),
    ]);
    return { orgs, totalEvents, totalOrgs, totalRooms };
  },
  ["landing-stats"],
  { revalidate: 300 } // Cache for 5 minutes
);

export default async function Home() {
  const { orgs, totalEvents, totalOrgs, totalRooms } = await getLandingStats();

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
              Log in
            </Link>
            {orgs.length > 0 && (
              <Link
                href={`/${orgs[0].slug}`}
                className="text-sm font-semibold bg-gradient-to-r from-primary to-blue-600 text-white px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all"
              >
                Try Demo
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* ========== HERO ========== */}
      <section className="relative hero-mesh">
        {/* Animated grid overlay */}
        <div className="absolute inset-0 hero-grid opacity-40" />

        {/* Floating decorative elements */}
        <div className="absolute top-20 left-[10%] w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-float" />
        <div className="absolute top-40 right-[10%] w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-float-delay" />
        <div className="absolute bottom-10 left-[30%] w-64 h-64 bg-sky-500/5 rounded-full blur-3xl animate-float-slow" />

        <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-32 lg:pt-32 lg:pb-40">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="animate-fade-in-up inline-flex items-center gap-2.5 bg-white/80 backdrop-blur-sm text-primary text-sm font-semibold px-5 py-2 rounded-full border border-primary/15 shadow-sm mb-10">
              <div className="relative flex items-center justify-center">
                <Sparkles className="w-4 h-4 relative z-10" />
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
              </div>
              AI-Powered Room Scheduling
            </div>

            {/* Headline */}
            <h1 className="animate-fade-in-up-delay-1 text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.05]">
              Room scheduling,
              <br />
              <span className="bg-gradient-to-r from-primary via-blue-600 to-indigo-600 bg-clip-text text-transparent animate-gradient-shift">
                powered by AI
              </span>
            </h1>

            {/* Subheadline */}
            <p className="animate-fade-in-up-delay-2 mt-8 text-xl lg:text-2xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-light">
              The modern platform for managing rooms, events, and approvals.
              <span className="text-slate-700 font-normal"> Book by conversation.</span>
              {" "}Deploy in minutes.
            </p>

            {/* CTA Buttons */}
            <div className="animate-fade-in-up-delay-3 mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              {orgs.length > 0 && (
                <Link
                  href={`/${orgs[0].slug}`}
                  className="group relative bg-gradient-to-r from-primary to-blue-600 text-white px-10 py-4 rounded-2xl text-lg font-semibold hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-1 transition-all flex items-center gap-3 overflow-hidden"
                >
                  <span className="absolute inset-0 animate-shimmer" />
                  <span className="relative">Try Live Demo</span>
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

            <p className="animate-fade-in-up-delay-4 mt-5 text-sm text-slate-400">
              No sign-up required for the demo
            </p>
          </div>

          {/* Floating UI preview cards */}
          <div className="hidden lg:block">
            {/* Left floating card */}
            <div className="absolute left-[5%] top-[45%] animate-float-slow">
              <div className="glass-card rounded-2xl p-4 shadow-xl shadow-slate-200/50 w-56">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Event Approved</p>
                    <p className="text-[10px] text-slate-400">Just now</p>
                  </div>
                </div>
                <div className="h-1.5 bg-emerald-100 rounded-full">
                  <div className="h-full w-full bg-emerald-500 rounded-full" />
                </div>
              </div>
            </div>

            {/* Right floating card */}
            <div className="absolute right-[5%] top-[35%] animate-float">
              <div className="glass-card rounded-2xl p-4 shadow-xl shadow-slate-200/50 w-60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">AI Assistant</p>
                    <p className="text-[10px] text-slate-400">Finding rooms...</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    &ldquo;Book Conference Room A for tomorrow at 2 PM&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60V20C240 45 480 55 720 45C960 35 1200 15 1440 25V60H0Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ========== LIVE STATS ========== */}
      <section className="relative -mt-1 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid grid-cols-3 gap-8">
            <StatBlock value={totalEvents} label="Events Managed" />
            <StatBlock value={totalOrgs} label="Organizations" />
            <StatBlock value={totalRooms} label="Rooms Configured" />
          </div>
        </div>
      </section>

      {/* ========== FEATURES ========== */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-6 pt-8 pb-24">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-primary text-sm font-semibold mb-4 bg-primary/5 px-4 py-1.5 rounded-full">
              <Layers className="w-4 h-4" />
              Platform Features
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
              Everything you need
            </h2>
            <p className="mt-5 text-xl text-slate-500 max-w-2xl mx-auto">
              A complete scheduling platform built for modern organizations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon={<MessageSquare className="w-6 h-6" />}
              title="AI-Powered Booking"
              description="Book rooms with natural language. Just say what you need and let AI find the perfect space and time."
              gradient="from-blue-500 to-primary"
            />
            <FeatureCard
              icon={<Building2 className="w-6 h-6" />}
              title="Multi-Tenant Architecture"
              description="One platform, unlimited organizations. Each with their own rooms, rules, and customizable labels."
              gradient="from-violet-500 to-purple-600"
            />
            <FeatureCard
              icon={<Calendar className="w-6 h-6" />}
              title="Smart Calendars"
              description="Month, week, day, and year views with real-time availability, conflict detection, and iCal feeds."
              gradient="from-sky-500 to-cyan-600"
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Approval Workflows"
              description="Configurable approval chains with email notifications, comments, and full activity tracking."
              gradient="from-amber-500 to-orange-600"
            />
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6" />}
              title="Analytics & Reports"
              description="Room utilization, event trends, and usage analytics to optimize your space management."
              gradient="from-emerald-500 to-green-600"
            />
            <FeatureCard
              icon={<Globe className="w-6 h-6" />}
              title="iCal & API Ready"
              description="Subscribe from Outlook, Google Calendar, or Apple Calendar. CSV import/export built in."
              gradient="from-rose-500 to-pink-600"
            />
            <FeatureCard
              icon={<Lock className="w-6 h-6" />}
              title="Role-Based Access"
              description="Admin, Manager, and User roles with granular permissions. Server-side authorization on every action."
              gradient="from-slate-600 to-slate-800"
            />
            <FeatureCard
              icon={<Clock className="w-6 h-6" />}
              title="Scheduling Rules"
              description="Opening hours, buffer periods, max duration limits, and advance booking cutoffs — all configurable."
              gradient="from-teal-500 to-teal-700"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Instant Deploy"
              description="Deploy to Vercel in one click. Serverless, auto-scaling, edge-optimized. Zero maintenance."
              gradient="from-indigo-500 to-indigo-700"
            />
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section className="relative bg-gradient-to-b from-slate-50 to-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-primary text-sm font-semibold mb-4 bg-primary/5 px-4 py-1.5 rounded-full">
              <ArrowRight className="w-4 h-4" />
              Simple Workflow
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
              How it works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-0">
            <StepCard
              step="1"
              title="Submit a request"
              description="Fill out a form or chat with the AI assistant to find and book available rooms instantly."
              icon={<MessageSquare className="w-5 h-5" />}
            />
            <StepCard
              step="2"
              title="Get approved"
              description="Managers receive email notifications and can approve or deny with one click from the dashboard."
              icon={<Shield className="w-5 h-5" />}
            />
            <StepCard
              step="3"
              title="On the calendar"
              description="Approved events appear on the shared calendar and sync via iCal to Outlook, Google, and Apple Calendar."
              icon={<Calendar className="w-5 h-5" />}
            />
          </div>
        </div>
      </section>

      {/* ========== WHY CHOOSE US ========== */}
      <section className="bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900">
              Built for organizations that care about their space
            </h2>
            <p className="mt-3 text-lg text-slate-500 max-w-2xl mx-auto">
              Whether you manage 5 rooms or 500, Scheduling Engine scales with you
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <TrustCard
              icon={<Shield className="w-5 h-5" />}
              title="Secure by default"
              description="Role-based access, server-side authorization on every action, encrypted connections"
            />
            <TrustCard
              icon={<Zap className="w-5 h-5" />}
              title="Always available"
              description="Serverless architecture with auto-scaling. No downtime, no maintenance windows"
            />
            <TrustCard
              icon={<Users className="w-5 h-5" />}
              title="Multi-organization"
              description="One deployment serves unlimited organizations, each with independent settings"
            />
            <TrustCard
              icon={<Globe className="w-5 h-5" />}
              title="Works everywhere"
              description="Responsive design, iCal sync, email notifications. Access from any device"
            />
          </div>
        </div>
      </section>

      {/* ========== CTA / DEMO ORGS ========== */}
      {orgs.length > 0 && (
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-blue-600 to-indigo-700" />
          <div className="absolute inset-0 hero-grid opacity-10" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

          <div className="relative max-w-7xl mx-auto px-6 py-20 text-center">
            <div className="inline-flex items-center gap-2 text-blue-100 text-sm font-semibold mb-6 bg-white/10 px-4 py-1.5 rounded-full border border-white/10">
              <Star className="w-4 h-4" />
              Live Demos
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
              See it in action
            </h2>
            <p className="text-blue-100 text-xl mb-10 max-w-xl mx-auto">
              Explore live organizations with rooms, events, calendars, and the AI assistant.
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

/* ===== Components ===== */

function StatBlock({ value, label }: { value: number; label: string }) {
  const formatted = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();
  return (
    <div className="text-center">
      <p className="text-4xl lg:text-5xl font-extrabold text-slate-900 stat-glow tracking-tight">
        {formatted}
        <span className="text-primary">+</span>
      </p>
      <p className="mt-2 text-sm font-medium text-slate-500 uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  gradient,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="feature-card rounded-2xl p-7 group cursor-default">
      <div
        className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center text-white mb-5 shadow-lg group-hover:scale-110 transition-transform`}
      >
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-slate-500 leading-relaxed text-[15px]">{description}</p>
    </div>
  );
}

function TrustCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center p-6">
      <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center text-primary mx-auto mb-4">
        {icon}
      </div>
      <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
  icon,
}: {
  step: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="step-connector text-center lg:px-8">
      <div className="relative inline-flex mb-6">
        <div className="w-14 h-14 bg-gradient-to-br from-primary to-blue-600 text-white rounded-2xl flex items-center justify-center text-xl font-bold shadow-lg shadow-primary/20">
          {step}
        </div>
        <div className="absolute -right-2 -top-2 w-8 h-8 bg-white border-2 border-primary/20 rounded-lg flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-500 leading-relaxed max-w-xs mx-auto">{description}</p>
    </div>
  );
}
