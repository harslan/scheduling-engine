import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Calendar,
  Building2,
  Zap,
  Shield,
  MessageSquare,
  Globe,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export default async function Home() {
  // Get orgs for the demo section
  const orgs = await prisma.organization.findMany({
    select: { slug: true, name: true, appDisplayName: true },
    take: 5,
  });

  return (
    <div className="min-h-full bg-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">
              Scheduling Engine
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Log in
            </Link>
            {orgs.length > 0 && (
              <Link
                href={`/${orgs[0].slug}`}
                className="text-sm font-medium bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Try Demo
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-50" />
        <div className="relative max-w-7xl mx-auto px-6 py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-8">
            <Sparkles className="w-4 h-4" />
            AI-Powered Room Scheduling
          </div>
          <h1 className="text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
            Room scheduling,
            <br />
            <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              powered by AI
            </span>
          </h1>
          <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            The modern platform for managing rooms, events, and approvals.
            Book by conversation. Deploy in minutes.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {orgs.length > 0 && (
              <Link
                href={`/${orgs[0].slug}`}
                className="bg-primary text-white px-8 py-3.5 rounded-xl text-lg font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 flex items-center gap-2"
              >
                Try Live Demo
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}
            <Link
              href="/login"
              className="border border-slate-300 text-slate-700 px-8 py-3.5 rounded-xl text-lg font-semibold hover:bg-slate-50 transition-colors"
            >
              Sign In
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            No sign-up required for the demo
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-slate-900">
            Everything you need
          </h2>
          <p className="mt-3 text-lg text-slate-500">
            A complete scheduling platform built for modern organizations.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={<MessageSquare className="w-6 h-6" />}
            title="AI-Powered Booking"
            description="Book rooms with natural language. Just say what you need and let AI find the perfect space and time."
          />
          <FeatureCard
            icon={<Building2 className="w-6 h-6" />}
            title="Multi-Tenant"
            description="One platform, unlimited organizations. Each with their own rooms, rules, and customizable labels."
          />
          <FeatureCard
            icon={<Calendar className="w-6 h-6" />}
            title="Smart Calendars"
            description="Month, week, and day views with real-time availability, conflict detection, and iCal feeds."
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6" />}
            title="Approval Workflows"
            description="Configurable approval chains with email notifications and activity tracking."
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6" />}
            title="Instant Deploy"
            description="Deploy to Vercel in one click. Serverless, auto-scaling, zero maintenance."
          />
          <FeatureCard
            icon={<Globe className="w-6 h-6" />}
            title="iCal & API Ready"
            description="Subscribe from Outlook, Google Calendar, or Apple Calendar. Full API for integrations."
          />
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900">
              How it works
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <StepCard
              step="1"
              title="Submit a request"
              description="Fill out a form or chat with the AI assistant to find and book available rooms."
            />
            <StepCard
              step="2"
              title="Get approved"
              description="Managers receive email notifications and can approve or deny from the dashboard."
            />
            <StepCard
              step="3"
              title="On the calendar"
              description="Approved events appear on the shared calendar and sync via iCal to your apps."
            />
          </div>
        </div>
      </section>

      {/* Built with */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900">Built with</h2>
          <p className="mt-3 text-lg text-slate-500">
            Modern, reliable technology stack
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-slate-400">
          {["Next.js 16", "React 19", "TypeScript", "Prisma", "Tailwind CSS", "Claude AI", "Vercel", "PostgreSQL"].map(
            (tech) => (
              <div
                key={tech}
                className="flex items-center gap-2 text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-slate-700">{tech}</span>
              </div>
            )
          )}
        </div>
      </section>

      {/* Demo orgs */}
      {orgs.length > 0 && (
        <section className="bg-gradient-to-r from-primary to-blue-600">
          <div className="max-w-7xl mx-auto px-6 py-16 text-center">
            <h2 className="text-3xl font-bold text-white mb-3">
              See it in action
            </h2>
            <p className="text-blue-100 text-lg mb-8">
              Explore a live organization with rooms, events, and the AI assistant.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {orgs.map((org) => (
                <Link
                  key={org.slug}
                  href={`/${org.slug}`}
                  className="bg-white/15 backdrop-blur-sm text-white border border-white/20 px-6 py-3 rounded-xl font-semibold hover:bg-white/25 transition-all"
                >
                  {org.appDisplayName || org.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Calendar className="w-4 h-4" />
            Scheduling Engine
          </div>
          <p className="text-sm text-slate-400">
            Modern room scheduling for the AI era.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg hover:border-primary/20 transition-all">
      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {step}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}
