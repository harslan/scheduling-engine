import Link from "next/link";
import {
  Calendar,
  Building2,
  Zap,
  Shield,
  MessageSquare,
  Globe,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-full">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">
              Scheduling Engine
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Room scheduling,
          <br />
          <span className="text-primary">powered by AI</span>
        </h1>
        <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          The modern platform for managing rooms, events, and approvals.
          Book by conversation. Deploy in minutes.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="bg-primary text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25"
          >
            Start Free Trial
          </Link>
          <Link
            href="/demo"
            className="border border-slate-300 text-slate-700 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-slate-100 transition-colors"
          >
            Live Demo
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<MessageSquare className="w-6 h-6" />}
            title="AI-Powered Booking"
            description="Book rooms with natural language. Just say what you need and let AI find the perfect space."
          />
          <FeatureCard
            icon={<Building2 className="w-6 h-6" />}
            title="Multi-Tenant"
            description="One platform, unlimited organizations. Each with their own rooms, rules, and branding."
          />
          <FeatureCard
            icon={<Calendar className="w-6 h-6" />}
            title="Smart Calendars"
            description="Year, month, week, and day views. Real-time availability with conflict detection."
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6" />}
            title="Approval Workflows"
            description="Configurable approval chains with automatic routing and smart auto-approval."
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6" />}
            title="Instant Deploy"
            description="Deploy to Vercel in one click. No servers to manage, scales automatically."
          />
          <FeatureCard
            icon={<Globe className="w-6 h-6" />}
            title="API & MCP Ready"
            description="Full REST API and MCP server. Integrate with any AI assistant or workflow."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-sm text-slate-500">
          Scheduling Engine &mdash; Modern room scheduling for the AI era.
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
    <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}
