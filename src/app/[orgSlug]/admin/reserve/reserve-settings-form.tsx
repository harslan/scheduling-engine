"use client";

import { useState } from "react";
import {
  updateReserveSettings,
  updateRoomReserveMapping,
  updateConfigTypeReserveMapping,
  updateEventTypeReserveMapping,
  testReserveConnection,
  triggerReserveSync,
  triggerReserveExport,
} from "@/lib/actions/reserve-settings";

interface Props {
  orgId: string;
  orgSlug: string;
  settings: {
    reserveEnabled: boolean;
    reserveExportEnabled: boolean;
    reserveImportMode: string | null;
    reserveGatewayUsername: string;
    reserveGatewayPassword: string;
    reserveWebhookSecret: string;
    reserveSiteName: string;
    reserveEventIdFieldName: string;
    reserveEventNotesFieldName: string;
    reserveEventOrgFieldName: string;
    reserveOwnerUsername: string;
    reserveSalespersonUsername: string;
    reserveLifecycleStage: string;
    reserveHoldFunctionType: string;
    reserveHoldContactId: string;
  };
  rooms: { id: string; name: string; reserveLocationName: string }[];
  configTypes: { id: string; name: string; reserveSetupStyle: string }[];
  eventTypes: { id: string; name: string; reserveFunctionType: string }[];
  recentLogs: {
    id: string;
    direction: string;
    status: string;
    eventsProcessed: number;
    errorMessage: string | null;
    createdAt: string;
  }[];
}

export function ReserveSettingsForm({
  orgId,
  orgSlug,
  settings,
  rooms,
  configTypes,
  eventTypes,
  recentLogs,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSettingsSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await updateReserveSettings(orgId, formData);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Settings saved" });
    }
    setSaving(false);
  }

  async function handleTestConnection() {
    setTesting(true);
    setMessage(null);
    const result = await testReserveConnection(orgId);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.message ?? "Connected" });
    }
    setTesting(false);
  }

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    const result = await triggerReserveSync(orgId);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.message ?? "Synced" });
    }
    setSyncing(false);
  }

  async function handleExport() {
    setExporting(true);
    setMessage(null);
    const result = await triggerReserveExport(orgId);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({
        type: result.success ? "success" : "error",
        text: result.message ?? "Export complete",
      });
    }
    setExporting(false);
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Main settings form */}
      <form onSubmit={handleSettingsSave}>
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Connection Settings
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="reserveEnabled"
                defaultChecked={settings.reserveEnabled}
                className="rounded border-slate-300"
                value="true"
              />
              <span className="text-sm text-slate-700">
                Enable Reserve Integration
              </span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="reserveExportEnabled"
                defaultChecked={settings.reserveExportEnabled}
                className="rounded border-slate-300"
                value="true"
              />
              <span className="text-sm text-slate-700">Enable Export</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Import Mode
            </label>
            <select
              name="reserveImportMode"
              defaultValue={settings.reserveImportMode ?? "off"}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="off">Off</option>
              <option value="manual">Manual (review before import)</option>
              <option value="automatic">Automatic</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Gateway Username
              </label>
              <input
                type="text"
                name="reserveGatewayUsername"
                defaultValue={settings.reserveGatewayUsername}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Gateway Password
              </label>
              <input
                type="password"
                name="reserveGatewayPassword"
                defaultValue={settings.reserveGatewayPassword}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Site Name
              </label>
              <input
                type="text"
                name="reserveSiteName"
                defaultValue={settings.reserveSiteName}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Webhook Secret
              </label>
              <input
                type="text"
                name="reserveWebhookSecret"
                defaultValue={settings.reserveWebhookSecret}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-xs"
              />
            </div>
          </div>

          {settings.reserveWebhookSecret && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">
                Webhook URL
              </p>
              <code className="text-xs text-slate-700 break-all">
                {typeof window !== "undefined"
                  ? window.location.origin
                  : "https://your-domain.com"}
                /api/reserve/webhook/{orgId}
              </code>
            </div>
          )}

          <h3 className="text-md font-semibold text-slate-900 pt-2">
            Export Field Configuration
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Event ID Field Name
              </label>
              <input
                type="text"
                name="reserveEventIdFieldName"
                defaultValue={settings.reserveEventIdFieldName}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. function.event.fieldName"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Event Notes Field Name
              </label>
              <input
                type="text"
                name="reserveEventNotesFieldName"
                defaultValue={settings.reserveEventNotesFieldName}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Event Organization Field Name
              </label>
              <input
                type="text"
                name="reserveEventOrgFieldName"
                defaultValue={settings.reserveEventOrgFieldName}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Owner Username
              </label>
              <input
                type="text"
                name="reserveOwnerUsername"
                defaultValue={settings.reserveOwnerUsername}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Salesperson Username
              </label>
              <input
                type="text"
                name="reserveSalespersonUsername"
                defaultValue={settings.reserveSalespersonUsername}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Lifecycle Stage
              </label>
              <input
                type="text"
                name="reserveLifecycleStage"
                defaultValue={settings.reserveLifecycleStage}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Hold Function Type
              </label>
              <input
                type="text"
                name="reserveHoldFunctionType"
                defaultValue={settings.reserveHoldFunctionType}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Hold Contact ID
              </label>
              <input
                type="text"
                name="reserveHoldContactId"
                defaultValue={settings.reserveHoldContactId}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync Data"}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {exporting ? "Exporting..." : "Export Now"}
            </button>
          </div>
        </div>
      </form>

      {/* Room mapping */}
      <MappingTable
        title="Room → Reserve Location"
        description="Map each room to its Reserve location name"
        items={rooms}
        fieldLabel="Reserve Location Name"
        fieldKey="reserveLocationName"
        onSave={(id, value) => updateRoomReserveMapping(orgId, id, value)}
      />

      {/* Config type mapping */}
      <MappingTable
        title="Configuration Type → Reserve Setup Style"
        description="Map each configuration type to its Reserve setup style"
        items={configTypes}
        fieldLabel="Reserve Setup Style"
        fieldKey="reserveSetupStyle"
        onSave={(id, value) =>
          updateConfigTypeReserveMapping(orgId, id, value)
        }
      />

      {/* Event type mapping */}
      <MappingTable
        title="Event Type → Reserve Function Type"
        description="Map each event type to its Reserve function type"
        items={eventTypes}
        fieldLabel="Reserve Function Type"
        fieldKey="reserveFunctionType"
        onSave={(id, value) =>
          updateEventTypeReserveMapping(orgId, id, value)
        }
      />

      {/* Sync history */}
      {recentLogs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Sync History
          </h2>
          <div className="divide-y divide-slate-100">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      log.status === "success"
                        ? "bg-green-100 text-green-700"
                        : log.status === "partial"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {log.status}
                  </span>
                  <span className="text-sm text-slate-700 capitalize">
                    {log.direction}
                  </span>
                  <span className="text-sm text-slate-400">
                    {log.eventsProcessed} event
                    {log.eventsProcessed !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {log.errorMessage && (
                    <span
                      className="text-xs text-red-500 max-w-xs truncate"
                      title={log.errorMessage}
                    >
                      {log.errorMessage}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MappingTable({
  title,
  description,
  items,
  fieldLabel,
  fieldKey,
  onSave,
}: {
  title: string;
  description: string;
  items: { id: string; name: string; [key: string]: string }[];
  fieldLabel: string;
  fieldKey: string;
  onSave: (id: string, value: string) => Promise<{ success?: boolean; error?: string }>;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">{title}</h2>
      <p className="text-sm text-slate-500 mb-4">{description}</p>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">No items to map.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <MappingRow
              key={item.id}
              name={item.name}
              value={item[fieldKey]}
              fieldLabel={fieldLabel}
              onSave={(value) => onSave(item.id, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MappingRow({
  name,
  value,
  fieldLabel,
  onSave,
}: {
  name: string;
  value: string;
  fieldLabel: string;
  onSave: (value: string) => Promise<{ success?: boolean; error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(currentValue);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-4 py-2">
      <span className="text-sm font-medium text-slate-700 w-48 shrink-0">
        {name}
      </span>
      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            placeholder={fieldLabel}
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50"
          >
            {saving ? "..." : "Save"}
          </button>
          <button
            onClick={() => {
              setCurrentValue(value);
              setEditing(false);
            }}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1">
          <span
            className={`text-sm ${currentValue ? "text-slate-600" : "text-slate-300 italic"}`}
          >
            {currentValue || "Not mapped"}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-primary hover:text-primary/80 font-medium"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
