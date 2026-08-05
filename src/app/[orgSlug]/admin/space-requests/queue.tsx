"use client";

import { useState } from "react";
import { Check, X, Clock, Building2 } from "lucide-react";
import { approveRoomRequest, denyRoomRequest } from "@/lib/actions/room-requests";

interface RequestData {
  id: string;
  description: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  expectedAttendeeCount: number | null;
  requestedStartDateTime: string | null;
  requestedEndDateTime: string | null;
  status: string;
  processedAt: string | null;
  processedByName: string | null;
  denialReason: string;
  createdAt: string;
}

export function SpaceRequestsQueue({
  requests,
  rooms,
  orgSlug,
  timezone,
}: {
  requests: RequestData[];
  rooms: { id: string; name: string }[];
  orgSlug: string;
  timezone: string;
}) {
  const pending = requests.filter((r) => r.status === "PENDING");
  const processed = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-amber-600 mb-3">
            Pending ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                rooms={rooms}
                orgSlug={orgSlug}
                timezone={timezone}
              />
            ))}
          </div>
        </div>
      )}

      {processed.length > 0 && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">
            Processed ({processed.length})
          </h2>
          <div className="space-y-3">
            {processed.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                rooms={rooms}
                orgSlug={orgSlug}
                timezone={timezone}
                readonly
              />
            ))}
          </div>
        </div>
      )}

      {requests.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No space requests yet.</p>
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  rooms,
  orgSlug,
  timezone,
  readonly,
}: {
  request: RequestData;
  rooms: { id: string; name: string }[];
  orgSlug: string;
  timezone: string;
  readonly?: boolean;
}) {
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [denialReason, setDenialReason] = useState("");
  const [showDeny, setShowDeny] = useState(false);
  const [loading, setLoading] = useState(false);

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, { timeZone: timezone });
  };

  async function handleApprove() {
    setLoading(true);
    await approveRoomRequest(request.id, orgSlug, selectedRoomId || undefined);
    setLoading(false);
  }

  async function handleDeny() {
    setLoading(true);
    await denyRoomRequest(request.id, orgSlug, denialReason);
    setLoading(false);
  }

  const statusColors: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
    DENIED: "bg-red-50 text-red-700",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-slate-900">{request.description}</p>
          <p className="text-sm text-slate-500">
            {request.contactName} &middot; {request.contactEmail}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[request.status] || ""}`}
        >
          {request.status}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
        <div>
          <span className="text-slate-400">Start</span>
          <p className="text-slate-700">
            {formatDate(request.requestedStartDateTime)}
          </p>
        </div>
        <div>
          <span className="text-slate-400">End</span>
          <p className="text-slate-700">
            {formatDate(request.requestedEndDateTime)}
          </p>
        </div>
        {request.expectedAttendeeCount && (
          <div>
            <span className="text-slate-400">Attendees</span>
            <p className="text-slate-700">{request.expectedAttendeeCount}</p>
          </div>
        )}
        <div>
          <span className="text-slate-400">Submitted</span>
          <p className="text-slate-700">{formatDate(request.createdAt)}</p>
        </div>
      </div>

      {request.status === "DENIED" && request.denialReason && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-2 text-sm text-red-700 mb-4">
          <strong>Reason:</strong> {request.denialReason}
        </div>
      )}

      {request.processedByName && (
        <p className="text-xs text-slate-400 mb-3">
          Processed by {request.processedByName} on{" "}
          {formatDate(request.processedAt)}
        </p>
      )}

      {!readonly && request.status === "PENDING" && (
        <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm"
          >
            <option value="">Assign a room...</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Approve
          </button>

          {!showDeny ? (
            <button
              onClick={() => setShowDeny(true)}
              className="flex items-center gap-1 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <X className="w-4 h-4" />
              Deny
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                placeholder="Reason..."
                className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm w-48"
              />
              <button
                onClick={handleDeny}
                disabled={loading}
                className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Confirm Deny
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
