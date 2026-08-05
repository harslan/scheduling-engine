"use client";

import { useState } from "react";
import { Save, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import {
  updateApproverSettings,
  addBackupApprover,
  removeBackupApprover,
  reorderBackupApprover,
} from "./actions";

interface MemberOption {
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface BackupEntry {
  id: string;
  approverId: string;
  approverName: string;
  backupUserId: string;
  backupName: string;
  sortOrder: number;
}

export function BackupApproversManager({
  orgId,
  orgSlug,
  primaryApproverId,
  roomAssignmentApproverId,
  members,
  backups,
}: {
  orgId: string;
  orgSlug: string;
  primaryApproverId: string | null;
  roomAssignmentApproverId: string | null;
  members: MemberOption[];
  backups: BackupEntry[];
}) {
  const [primaryId, setPrimaryId] = useState(primaryApproverId || "");
  const [roomApprId, setRoomApprId] = useState(roomAssignmentApproverId || "");
  const [newBackupUserId, setNewBackupUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const result = await updateApproverSettings(orgId, orgSlug, {
      approverId: primaryId || null,
      roomAssignmentApproverId: roomApprId || null,
    });
    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage("Saved!");
      setTimeout(() => setMessage(""), 2000);
    }
    setSaving(false);
  }

  async function handleAddBackup() {
    if (!primaryId || !newBackupUserId) return;
    setSaving(true);
    await addBackupApprover(orgId, orgSlug, {
      approverId: primaryId,
      backupUserId: newBackupUserId,
      sortOrder: backups.length,
    });
    setNewBackupUserId("");
    setSaving(false);
  }

  async function handleRemove(id: string) {
    setSaving(true);
    await removeBackupApprover(id, orgSlug);
    setSaving(false);
  }

  async function handleReorder(id: string, direction: "up" | "down") {
    setSaving(true);
    await reorderBackupApprover(id, orgSlug, direction);
    setSaving(false);
  }

  const inputCls =
    "w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all text-sm";

  return (
    <div className="space-y-6">
      {/* Primary Approvers */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-5 border-l-3 border-primary pl-3">
          Primary Approvers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Event Approver
            </label>
            <select
              value={primaryId}
              onChange={(e) => setPrimaryId(e.target.value)}
              className={inputCls}
            >
              <option value="">All Admins/Managers (default)</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Space Request Approver
            </label>
            <select
              value={roomApprId}
              onChange={(e) => setRoomApprId(e.target.value)}
              className={inputCls}
            >
              <option value="">All Admins/Managers (default)</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Approvers
          </button>
          {message && (
            <span className="text-sm text-emerald-600">{message}</span>
          )}
        </div>
      </div>

      {/* Backup Approvers */}
      {primaryId && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-5 border-l-3 border-primary pl-3">
            Backup Approvers
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Backup approvers receive approval notifications alongside the
            primary approver, ranked by priority.
          </p>

          {backups.length > 0 && (
            <div className="space-y-2 mb-4">
              {backups.map((backup, i) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-6">
                      #{i + 1}
                    </span>
                    <span className="text-sm text-slate-700">
                      {backup.backupName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleReorder(backup.id, "up")}
                      disabled={saving || i === 0}
                      className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-30"
                      title="Move up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleReorder(backup.id, "down")}
                      disabled={saving || i === backups.length - 1}
                      className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-30"
                      title="Move down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(backup.id)}
                      disabled={saving}
                      className="text-red-400 hover:text-red-600 transition-colors ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <select
              value={newBackupUserId}
              onChange={(e) => setNewBackupUserId(e.target.value)}
              className={`flex-1 ${inputCls}`}
            >
              <option value="">Select backup approver...</option>
              {members
                .filter(
                  (m) =>
                    m.userId !== primaryId &&
                    !backups.some((b) => b.backupUserId === m.userId)
                )
                .map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} ({m.email})
                  </option>
                ))}
            </select>
            <button
              onClick={handleAddBackup}
              disabled={saving || !newBackupUserId}
              className="flex items-center gap-1 bg-primary text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
