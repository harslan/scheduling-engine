"use client";

import { Calendar, RefreshCw, ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-full flex flex-col bg-white">
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
        </div>
      </header>

      <main className="flex-1 relative hero-mesh">
        <div className="absolute inset-0 hero-grid opacity-20" />

        <div className="relative flex items-center justify-center min-h-[calc(100vh-73px)] pb-20">
          <div className="text-center max-w-md px-6">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm border border-red-100">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mb-2 tracking-tight">
              Something went wrong
            </h1>
            <p className="text-slate-500 mb-8 leading-relaxed">
              An unexpected error occurred. This has been logged and
              we&apos;ll look into it. You can try again or head back to the
              home page.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={reset}
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-blue-600 text-white px-8 py-3.5 rounded-2xl font-semibold hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
              <Link
                href="/"
                className="flex items-center gap-2 bg-white border-2 border-slate-200 text-slate-700 px-8 py-3.5 rounded-2xl font-semibold hover:border-primary/30 hover:bg-primary/5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to home
              </Link>
            </div>
            {error.digest && (
              <p className="mt-8 text-xs text-slate-400">
                Error reference:{" "}
                <code className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                  {error.digest}
                </code>
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
