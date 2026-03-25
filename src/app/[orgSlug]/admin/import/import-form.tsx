"use client";

import { useState } from "react";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { importEvents } from "@/lib/actions/import-events";

export function ImportForm({ orgSlug }: { orgSlug: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    imported?: number;
    total?: number;
    errors?: string[];
    error?: string;
  } | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const text = await file.text();
      const res = await importEvents(orgSlug, text);
      setResult(res);
    } catch {
      setResult({ error: "Failed to process file" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label className="block">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileUpload}
          disabled={loading}
          className="hidden"
          id="csv-upload"
        />
        <label
          htmlFor="csv-upload"
          className={`inline-flex items-center gap-2 border-2 border-dashed border-slate-300 rounded-lg px-6 py-4 text-sm font-medium transition-colors cursor-pointer ${
            loading
              ? "bg-slate-50 text-slate-400"
              : "hover:border-primary hover:bg-primary/5 text-slate-600"
          }`}
        >
          <Upload className="w-5 h-5" />
          {loading ? "Importing..." : "Choose CSV file to import"}
        </label>
      </label>

      {result && (
        <div className="mt-4">
          {result.error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              {result.error}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                Imported {result.imported} of {result.total} events successfully.
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm">
                  <p className="font-medium text-amber-700 mb-2">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    {result.errors.length} warning{result.errors.length !== 1 ? "s" : ""}:
                  </p>
                  <ul className="space-y-0.5 text-amber-600 text-xs max-h-40 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
