"use client";

import { updateMemberRole, removeMember, toggleUserActive } from "@/lib/actions/users";
import { Shield, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";

interface MemberData {
  userId: string;
  role: string;
  userName: string;
  userEmail: string;
  isSystemAdmin: boolean;
  active: boolean;
  lastLoginAt: string | null;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ADMIN: { label: "Admin", color: "bg-purple-50 text-purple-700 border-purple-200" },
  MANAGER: { label: "Manager", color: "bg-blue-50 text-blue-700 border-blue-200" },
  EVENT_SUPPORT: { label: "Event Support", color: "bg-teal-50 text-teal-700 border-teal-200" },
  USER: { label: "User", color: "bg-slate-50 text-slate-600 border-slate-200" },
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function UserRow({
  member,
  organizationId,
  orgSlug,
  mobileMode,
}: {
  member: MemberData;
  organizationId: string;
  orgSlug: string;
  mobileMode?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [optimisticActive, setOptimisticActive] = useState<boolean | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const isActive = optimisticActive ?? member.active;

  async function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setLoading(true);
    await updateMemberRole(
      organizationId,
      member.userId,
      e.target.value as "ADMIN" | "MANAGER" | "EVENT_SUPPORT" | "USER"
    );
    setLoading(false);
  }

  async function handleToggleActive() {
    setOptimisticActive(!isActive);
    setTogglingActive(true);
    await toggleUserActive(organizationId, member.userId);
    setOptimisticActive(null);
    setTogglingActive(false);
  }

  async function handleRemove() {
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      return;
    }
    setLoading(true);
    await removeMember(organizationId, member.userId);
    setLoading(false);
    setConfirmingRemove(false);
  }

  const roleInfo = ROLE_LABELS[member.role] || ROLE_LABELS.USER;

  if (mobileMode) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-4 shadow-sm ${!isActive ? "opacity-60" : ""}`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">
            {(member.userName || member.userEmail).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900 truncate">
              {member.userName || "—"}
              {member.isSystemAdmin && (
                <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-amber-600">
                  <Shield className="w-3 h-3" /> Sys Admin
                </span>
              )}
            </p>
            <p className="text-sm text-slate-500 truncate">{member.userEmail}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <span className={`inline-block w-2 h-2 rounded-full ${isActive ? "bg-green-500" : "bg-slate-300"}`} />
                {isActive ? "Active" : "Inactive"}
              </span>
              <span>{relativeTime(member.lastLoginAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <select
            value={member.role}
            onChange={handleRoleChange}
            disabled={loading}
            className={`px-2.5 py-1.5 rounded-full text-xs font-medium border cursor-pointer ${roleInfo.color}`}
            aria-label="User role"
          >
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="EVENT_SUPPORT">Event Support</option>
            <option value="USER">User</option>
          </select>
          {confirmingRemove ? (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-red-600 font-medium">Remove?</span>
              <button
                onClick={handleRemove}
                disabled={loading}
                className="px-2 py-0.5 bg-red-500 text-white rounded text-xs font-medium disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
              </button>
              <button
                onClick={() => setConfirmingRemove(false)}
                className="px-2 py-0.5 text-slate-500"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={handleRemove}
              disabled={loading}
              className="px-3 py-1.5 text-sm border border-red-200 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <tr className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${!isActive ? "[&_td]:text-slate-400" : ""}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
            {(member.userName || member.userEmail).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-slate-900">
              {member.userName || "—"}
              {member.isSystemAdmin && (
                <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-amber-600">
                  <Shield className="w-3 h-3" /> Sys Admin
                </span>
              )}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{member.userEmail}</td>
      <td className="px-4 py-3">
        <select
          value={member.role}
          onChange={handleRoleChange}
          disabled={loading}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer ${roleInfo.color}`}
          aria-label="User role"
        >
          <option value="ADMIN">Admin</option>
          <option value="MANAGER">Manager</option>
          <option value="EVENT_SUPPORT">Event Support</option>
          <option value="USER">User</option>
        </select>
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={handleToggleActive}
          disabled={togglingActive}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            isActive ? "bg-green-500" : "bg-slate-300"
          } ${togglingActive ? "opacity-50" : ""}`}
          aria-label={isActive ? "Deactivate user" : "Activate user"}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
              isActive ? "translate-x-[18px]" : "translate-x-[2px]"
            }`}
          />
        </button>
      </td>
      <td className="px-4 py-3 text-sm text-slate-500">
        {relativeTime(member.lastLoginAt)}
      </td>
      <td className="px-4 py-3 text-right">
        {confirmingRemove ? (
          <div className="flex items-center justify-end gap-1.5 text-xs">
            <span className="text-red-600 font-medium">Remove?</span>
            <button
              onClick={handleRemove}
              disabled={loading}
              className="px-2 py-0.5 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
            </button>
            <button
              onClick={() => setConfirmingRemove(false)}
              className="px-2 py-0.5 text-slate-500 hover:text-slate-700 transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={handleRemove}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            title="Remove from organization"
            aria-label={`Remove ${member.userName || member.userEmail}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
}
