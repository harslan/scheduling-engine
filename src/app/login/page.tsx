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
  ArrowRight,
  AlertCircle,
  Sparkles,
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
      {/* ============ Left Panel ============ */}
      <div className="hidden lg:flex lg:w-[520px] xl:w-[580px] bg-slate-950 relative overflow-hidden flex-col justify-between p-12 xl:p-14">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 hero-grid opacity-[0.04]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

        {/* Gradient orbs for depth */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-primary/[0.07] rounded-full blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] bg-indigo-500/[0.05] rounded-full blur-[80px]" />

        {/* Geometric accent — concentric frames suggesting UI depth */}
        <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-[520px] h-[380px] border border-white/[0.025] rounded-3xl rotate-[5deg] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          <div className="w-[420px] h-[300px] border border-white/[0.035] rounded-2xl rotate-[2.5deg] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          <div className="w-[320px] h-[220px] border border-white/[0.05] rounded-xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full justify-between">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -inset-1 bg-primary/20 rounded-xl blur-md -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Scheduling Engine
            </span>
          </Link>

          {/* Headline + features */}
          <div>
            <h1 className="text-[2.75rem] xl:text-5xl font-extrabold text-white leading-[1.08] tracking-tight">
              Room scheduling,
              <br />
              <span className="bg-gradient-to-r from-primary via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                powered by AI
              </span>
            </h1>
            <p className="mt-5 text-slate-400 text-[15px] leading-relaxed max-w-[340px]">
              Manage rooms, events, and approvals across your entire
              organization from one platform.
            </p>

            <div className="mt-10 space-y-4">
              {[
                {
                  icon: Clock,
                  text: "Real-time calendar with instant availability",
                },
                {
                  icon: Shield,
                  text: "Configurable multi-level approval workflows",
                },
                {
                  icon: Sparkles,
                  text: "AI-powered scheduling assistant",
                },
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/[0.08] flex items-center justify-center text-primary/70">
                    <feature.icon className="w-4 h-4" />
                  </div>
                  <span className="text-[13px] text-slate-400">
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom tagline */}
          <p className="text-[13px] text-slate-600">
            Intelligent scheduling for modern organizations
          </p>
        </div>
      </div>

      {/* ============ Right Panel ============ */}
      <div className="flex-1 flex flex-col min-h-screen bg-gradient-to-b from-slate-50/80 to-white">
        {/* Mobile header */}
        <header className="flex items-center px-6 sm:px-10 py-5">
          <Link
            href="/"
            className="lg:hidden inline-flex items-center gap-2.5"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              Scheduling Engine
            </span>
          </Link>
        </header>

        {/* Centered form */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 pb-16">
          <div className="w-full max-w-[400px]">
            <div className="mb-8">
              <h2 className="text-[1.75rem] font-extrabold text-slate-900 tracking-tight">
                Sign in
              </h2>
              <p className="text-sm text-slate-500 mt-1.5">
                Enter your credentials to continue
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-100 p-6 sm:p-7">
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
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Password
                  </label>
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
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-blue-600 text-white py-3 rounded-xl text-sm font-semibold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md disabled:hover:translate-y-0"
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

            <p className="mt-6 text-center text-xs text-slate-400">
              Need access?{" "}
              <span className="text-slate-500">
                Contact your organization administrator
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-6 sm:px-10 py-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <Lock className="w-3 h-3" />
          Encrypted connection
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
