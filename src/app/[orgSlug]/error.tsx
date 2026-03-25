"use client";

import { RefreshCw, AlertTriangle } from "lucide-react";

export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-100">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-slate-500 mb-6">
          An error occurred while loading this page. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-primary-dark transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
        {error.digest && (
          <p className="mt-4 text-xs text-slate-400">
            Reference: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  );
}
