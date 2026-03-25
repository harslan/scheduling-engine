"use client";

import { useState } from "react";
import {
  refreshAndPreviewImport,
  applyReserveImport,
} from "@/lib/actions/reserve-import";
import Link from "next/link";

interface PreviewItem {
  reserveUniqueId: string;
  reserveEventNumber?: string;
  action: "create" | "update" | "delete";
  title: string;
  functions: {
    locationName: string;
    setupStyle: string;
    functionType: string;
    startDate: string;
    startTime: string;
    endTime: string;
    attendeeCount: number;
  }[];
  mappedRoom?: string;
  mappedConfigType?: string;
  mappedEventType?: string;
  conflicts: string[];
  existingEventId?: string;
}

export function ImportReviewClient({
  orgId,
  orgSlug,
}: {
  orgId: string;
  orgSlug: string;
}) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    eventsProcessed: number;
    errors: string[];
  } | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setError("");
    setResult(null);
    const res = await refreshAndPreviewImport(orgId);

    if (res.error) {
      setError(res.error);
      setPreview(null);
    } else if (res.preview) {
      setPreview(res.preview as PreviewItem[]);
      setSelected(new Set(res.preview.map((p: PreviewItem) => p.reserveUniqueId)));
    }
    setLoading(false);
  }

  async function handleApply() {
    if (selected.size === 0) return;
    setApplying(true);
    setError("");

    const res = await applyReserveImport(orgId, [...selected]);

    if (res.error) {
      setError(res.error);
    } else {
      setResult({
        eventsProcessed: res.eventsProcessed ?? 0,
        errors: res.errors ?? [],
      });
      setPreview(null);
    }
    setApplying(false);
  }

  function toggleSelect(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function selectAll() {
    if (!preview) return;
    setSelected(new Set(preview.map((p) => p.reserveUniqueId)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <p className="font-medium">
            Import complete: {result.eventsProcessed} event
            {result.eventsProcessed !== 1 ? "s" : ""} processed
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.errors.map((err, i) => (
                <li key={i} className="text-red-600 text-xs">
                  {err}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh from Reserve"}
        </button>

        {preview && preview.length > 0 && (
          <>
            <button
              onClick={handleApply}
              disabled={applying || selected.size === 0}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {applying
                ? "Importing..."
                : `Import ${selected.size} Selected`}
            </button>
            <button
              onClick={selectAll}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="text-sm text-slate-400 hover:text-slate-600 font-medium"
            >
              Select None
            </button>
          </>
        )}

        <Link
          href={`/${orgSlug}/admin/reserve`}
          className="text-sm text-slate-400 hover:text-slate-600 ml-auto"
        >
          Back to Settings
        </Link>
      </div>

      {/* Preview table */}
      {preview && preview.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-slate-500">
            No events found to import from Reserve.
          </p>
        </div>
      )}

      {preview && preview.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-10 px-4 py-3" />
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Action
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Title
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Room
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Date/Time
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Issues
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.map((item) => {
                const primaryFn = item.functions[0];
                return (
                  <tr
                    key={item.reserveUniqueId}
                    className={`${
                      item.conflicts.length > 0
                        ? "bg-amber-50/50"
                        : ""
                    } hover:bg-slate-50`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(item.reserveUniqueId)}
                        onChange={() => toggleSelect(item.reserveUniqueId)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.action === "create"
                            ? "bg-green-100 text-green-700"
                            : item.action === "update"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{item.title}</div>
                      {item.reserveEventNumber && (
                        <div className="text-xs text-slate-400">
                          #{item.reserveEventNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.mappedRoom ?? (
                        <span className="text-slate-300 italic">
                          {primaryFn?.locationName || "None"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.mappedEventType ?? (
                        <span className="text-slate-300 italic">
                          {primaryFn?.functionType || "None"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {primaryFn ? (
                        <div>
                          <div>{primaryFn.startDate}</div>
                          <div className="text-xs text-slate-400">
                            {primaryFn.startTime} - {primaryFn.endTime}
                          </div>
                          {item.functions.length > 1 && (
                            <div className="text-xs text-slate-400">
                              +{item.functions.length - 1} more
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.conflicts.length > 0 ? (
                        <div className="space-y-1">
                          {item.conflicts.map((c, i) => (
                            <div
                              key={i}
                              className="text-xs text-amber-600"
                            >
                              {c}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-green-500">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
