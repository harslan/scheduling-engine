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
  CheckCircle2,
  ArrowRight,
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
    <div className="min-h-full flex">
      {/* Left panel — brand/feature showcase */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden flex-col justify-between p-12">
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        {/* Decorative gradient orbs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl" />

        <div className="relative z-10">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-11 h-11 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10 group-hover:bg-white/15 transition-colors">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Scheduling Engine</span>
          </Link>

          {/* Headline */}
          <div className="mt-16">
            <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Streamline your<br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">scheduling workflow</span>
            </h1>
            <p className="mt-4 text-slate-400 text-base leading-relaxed max-w-sm">
              A unified platform for managing rooms, events, and approvals across your entire organization.
            </p>
          </div>

          {/* Feature list */}
          <div className="mt-12 space-y-5">
            {[
              { icon: <Clock className="w-4 h-4" />, text: "Real-time calendar with instant availability" },
              { icon: <Shield className="w-4 h-4" />, text: "Multi-level approval workflows" },
              { icon: <Users className="w-4 h-4" />, text: "Role-based access for teams of any size" },
              { icon: <CheckCircle2 className="w-4 h-4" />, text: "AI-powered booking assistant" },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.07] border border-white/[0.08] flex items-center justify-center text-blue-400">
                  {feature.icon}
                </div>
                <span className="text-sm text-slate-300">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom trust bar */}
        <div className="relative z-10 pt-8 border-t border-white/[0.08]">
          <p className="text-xs text-slate-500">
            Trusted by organizations worldwide for secure, reliable scheduling.
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex flex-col min-h-full bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 sm:px-10 py-5">
          <Link
            href="/"
            className="lg:hidden inline-flex items-center gap-2.5 group"
          >
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-primary/15">
              <Calendar className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900 tracking-tight">Scheduling Engine</span>
          </Link>
          <div className="lg:ml-auto" />
        </header>

        {/* Centered form */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 pb-16">
          <div className="w-full max-w-[400px]">
            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Sign in to your account
              </h2>
              <p className="text-sm text-slate-500 mt-1.5">
                Enter your credentials to access the platform
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <span className="text-red-500 text-xs font-bold">!</span>
                  </div>
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">
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
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all text-sm placeholder:text-slate-400"
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
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
                    className="w-full pl-10 pr-11 py-2.5 border border-slate-200 rounded-lg bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all text-sm placeholder:text-slate-400"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 focus:ring-2 focus:ring-slate-900/20 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>

        {/* Footer */}
        <footer className="px-6 sm:px-10 py-4 text-center">
          <p className="text-xs text-slate-400">
            Secured with end-to-end encryption
          </p>
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
