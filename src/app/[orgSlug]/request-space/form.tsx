"use client";

import { submitRoomRequest } from "@/lib/actions/room-requests";
import { useState } from "react";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

export function RequestSpaceForm({
  organizationId,
  orgSlug,
  defaultContactName,
  defaultContactEmail,
}: {
  organizationId: string;
  orgSlug: string;
  defaultContactName: string;
  defaultContactEmail: string;
}) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("organizationId", organizationId);

    const result = await submitRoomRequest(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
        <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Request Submitted!
        </h2>
        <p className="text-slate-500 mb-6">
          Your space request has been submitted. You&apos;ll receive an email
          when it&apos;s reviewed.
        </p>
        <Link
          href={`/${orgSlug}`}
          className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          Back to Calendar <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const inputCls =
    "w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-3 border-l-3 border-primary pl-3">
          Request Details
        </h2>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Description <span className="text-red-400">*</span>
          </label>
          <textarea
            name="description"
            required
            rows={3}
            className={`${inputCls} resize-y`}
            placeholder="Describe what you need the space for..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Start Date & Time <span className="text-red-400">*</span>
            </label>
            <input
              name="requestedStartDateTime"
              type="datetime-local"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              End Date & Time <span className="text-red-400">*</span>
            </label>
            <input
              name="requestedEndDateTime"
              type="datetime-local"
              required
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Expected Attendees
          </label>
          <input
            name="expectedAttendeeCount"
            type="number"
            min="1"
            className={inputCls}
            placeholder="Number of attendees"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-3 border-l-3 border-primary pl-3">
          Contact Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Contact Name <span className="text-red-400">*</span>
            </label>
            <input
              name="contactName"
              type="text"
              required
              defaultValue={defaultContactName}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Contact Email <span className="text-red-400">*</span>
            </label>
            <input
              name="contactEmail"
              type="email"
              required
              defaultValue={defaultContactEmail}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Contact Phone
          </label>
          <input
            name="contactPhone"
            type="tel"
            className={inputCls}
            placeholder="(555) 123-4567"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl text-lg font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit Request"
        )}
      </button>
    </form>
  );
}
