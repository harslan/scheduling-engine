"use client";

import { useState } from "react";
import {
  Calendar,
  Mail,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    setSent(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
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
            href="/login"
            className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>
        </div>
      </header>

      <main className="flex-1 relative hero-mesh">
        <div className="absolute inset-0 hero-grid opacity-20" />

        <div className="relative flex items-center justify-center min-h-[calc(100vh-73px)] px-6 py-16">
          <div className="w-full max-w-[420px]">
            {sent ? (
              /* Success state */
              <div className="text-center">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
                  Check your email
                </h1>
                <p className="text-slate-500 mb-8 leading-relaxed">
                  If an account exists for <strong className="text-slate-700">{email}</strong>,
                  we sent a password reset link. It expires in 1 hour.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-blue-600 text-white px-8 py-3.5 rounded-2xl font-semibold hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Link>
              </div>
            ) : (
              /* Form state */
              <>
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    Reset your password
                  </h1>
                  <p className="text-slate-500 mt-2">
                    Enter your email and we&apos;ll send you a reset link
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-7 sm:p-8">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label
                        htmlFor="reset-email"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Email address
                      </label>
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          id="reset-email"
                          type="email"
                          required
                          autoComplete="email"
                          autoFocus
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all text-sm placeholder:text-slate-400"
                          placeholder="you@company.com"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-blue-600 text-white py-3 rounded-2xl text-sm font-semibold hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Send reset link
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
