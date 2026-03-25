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
  Shield,
  Clock,
  Users,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Building2,
  BarChart3,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

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
    <div className="min-h-screen flex">
      {/* ============ Left Panel — Brand Showcase ============ */}
      <div className="hidden lg:flex lg:w-[520px] xl:w-[580px] 2xl:w-[640px] bg-slate-950 relative overflow-hidden flex-col p-12 xl:p-14">
        {/* Layered background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 hero-grid opacity-[0.07]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {/* Floating gradient orbs */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-primary/[0.08] rounded-full blur-[100px] animate-float-slow" />
        <div className="absolute top-1/3 -right-20 w-[400px] h-[400px] bg-indigo-500/[0.06] rounded-full blur-[80px] animate-float" />
        <div className="absolute -bottom-20 left-1/4 w-[350px] h-[350px] bg-blue-400/[0.05] rounded-full blur-[80px]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -inset-1 bg-primary/20 rounded-xl blur-md -z-10 group-hover:bg-primary/30 transition-colors" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Scheduling Engine
            </span>
          </Link>

          {/* Headline */}
          <div className="mt-14 xl:mt-16">
            <h1 className="text-[2.5rem] xl:text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
              Room scheduling,
              <br />
              <span className="bg-gradient-to-r from-primary via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                powered by AI
              </span>
            </h1>
            <p className="mt-5 text-slate-400 text-[15px] leading-relaxed max-w-[360px]">
              A unified platform for managing rooms, events, and approvals
              across your entire organization.
            </p>
          </div>

          {/* Feature cards — fills the middle space with substance */}
          <div className="mt-10 xl:mt-12 grid grid-cols-2 gap-3">
            {[
              {
                icon: <Clock className="w-4 h-4" />,
                title: "Real-time availability",
                desc: "Instant calendar views",
              },
              {
                icon: <Shield className="w-4 h-4" />,
                title: "Approval workflows",
                desc: "Multi-level routing",
              },
              {
                icon: <Users className="w-4 h-4" />,
                title: "Role-based access",
                desc: "Teams of any size",
              },
              {
                icon: <Sparkles className="w-4 h-4" />,
                title: "AI assistant",
                desc: "Smart scheduling",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
                  {feature.icon}
                </div>
                <div className="text-[13px] font-semibold text-white">
                  {feature.title}
                </div>
                <div className="text-[12px] text-slate-500 mt-0.5">
                  {feature.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Stats bar */}
          <div className="mt-auto pt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex -space-x-2">
                {[
                  "bg-blue-500",
                  "bg-indigo-500",
                  "bg-violet-500",
                  "bg-primary",
                ].map((color, i) => (
                  <div
                    key={i}
                    className={`w-7 h-7 rounded-full ${color} border-2 border-slate-950 flex items-center justify-center`}
                  >
                    <Building2 className="w-3 h-3 text-white" />
                  </div>
                ))}
              </div>
              <span className="text-[13px] text-slate-400">
                Trusted by leading universities
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-5 border-t border-white/[0.06]">
              {[
                { value: "50k+", label: "Events managed" },
                { value: "99.9%", label: "Uptime" },
                { value: "< 2s", label: "Avg. response" },
              ].map((stat, i) => (
                <div key={i}>
                  <div className="text-lg font-bold text-white">
                    {stat.value}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============ Right Panel — Login Form ============ */}
      <div className="flex-1 flex flex-col min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Mobile header */}
        <header className="flex items-center justify-between px-6 sm:px-10 py-5">
          <Link
            href="/"
            className="lg:hidden inline-flex items-center gap-2.5"
          >
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Calendar className="w-5 h-5 text-white" />
              </div>
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              Scheduling Engine
            </span>
          </Link>
          <div className="lg:ml-auto" />
        </header>

        {/* Centered form */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 pb-16">
          <div className="w-full max-w-[420px]">
            {/* Heading */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/[0.06] border border-primary/10 mb-5">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">
                  Enterprise-grade scheduling
                </span>
              </div>
              <h2 className="text-[1.75rem] font-extrabold text-slate-900 tracking-tight">
                Welcome back
              </h2>
              <p className="text-sm text-slate-500 mt-1.5">
                Sign in to continue to Scheduling Engine
              </p>
            </div>

            {/* Form card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 p-6 sm:p-7">
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
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all text-sm placeholder:text-slate-400"
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
                    <button
                      type="button"
                      className="text-xs text-primary hover:text-primary-dark font-medium transition-colors"
                      onClick={() => {
                        /* TODO: forgot password flow */
                      }}
                    >
                      Forgot password?
                    </button>
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
                      className="w-full pl-10 pr-11 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all text-sm placeholder:text-slate-400"
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
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-blue-600 text-white py-3 rounded-xl text-sm font-semibold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md disabled:hover:translate-y-0"
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

            {/* Help text below card */}
            <p className="mt-6 text-center text-xs text-slate-400">
              Need an account?{" "}
              <span className="text-slate-500">
                Contact your organization administrator
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-6 sm:px-10 py-4 flex items-center justify-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            Encrypted connection
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span className="flex items-center gap-1.5">
            <Shield className="w-3 h-3" />
            SOC 2 compliant
          </span>
        </footer>
      </div>
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
