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
    <div className="min-h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-red-50/20">
      <header className="px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-blue-600 rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">Scheduling Engine</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center pb-20">
        <div className="text-center max-w-md px-6">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-100">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            An unexpected error occurred. This has been logged and we&apos;ll look into it.
            You can try again or head back to the home page.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
            <Link
              href="/"
              className="flex items-center gap-2 border-2 border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>
          {error.digest && (
            <p className="mt-6 text-xs text-slate-400">
              Error reference: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{error.digest}</code>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
