"use client";

import { useState } from "react";
import { Save, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { updateEmailTemplate, resetEmailTemplate } from "./actions";

interface TemplateData {
  id: string;
  slug: string;
  name: string;
  subject: string;
  bodyHtml: string;
  active: boolean;
  hasOverride: boolean;
}

export function EmailTemplatesManager({
  templates,
  orgId,
  orgSlug,
}: {
  templates: TemplateData[];
  orgId: string;
  orgSlug: string;
}) {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {templates.map((template) => (
        <TemplateRow
          key={template.slug}
          template={template}
          orgId={orgId}
          orgSlug={orgSlug}
          expanded={expandedSlug === template.slug}
          onToggle={() =>
            setExpandedSlug(
              expandedSlug === template.slug ? null : template.slug
            )
          }
        />
      ))}
      {templates.length === 0 && (
        <p className="text-slate-400 text-sm py-8 text-center">
          No email templates found. Run the seed script to create default
          templates.
        </p>
      )}
    </div>
  );
}

function TemplateRow({
  template,
  orgId,
  orgSlug,
  expanded,
  onToggle,
}: {
  template: TemplateData;
  orgId: string;
  orgSlug: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.bodyHtml);
  const [active, setActive] = useState(template.active);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const result = await updateEmailTemplate(orgId, template.id, orgSlug, {
      subject,
      bodyHtml,
      active,
    });
    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage("Saved!");
      setTimeout(() => setMessage(""), 2000);
    }
    setSaving(false);
  }

  async function handleReset() {
    setSaving(true);
    setMessage("");
    const result = await resetEmailTemplate(orgId, template.id, orgSlug);
    if (result.error) {
      setMessage(result.error);
    } else {
      setSubject("");
      setBodyHtml("");
      setActive(true);
      setMessage("Reset to default!");
      setTimeout(() => setMessage(""), 2000);
    }
    setSaving(false);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <div>
            <span className="font-medium text-slate-900">{template.name}</span>
            <span className="ml-2 text-xs text-slate-400 font-mono">
              {template.slug}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {template.hasOverride && (
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
              Customized
            </span>
          )}
          {!template.active && (
            <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
              Disabled
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
            />
            <span className="text-sm text-slate-600">
              Active (sends emails)
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Subject Line
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all text-sm"
              placeholder="Leave blank for default"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Body HTML
            </label>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all text-sm font-mono resize-y"
              placeholder="Leave blank for default template"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save"}
            </button>
            {template.hasOverride && (
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to Default
              </button>
            )}
            {message && (
              <span
                className={`text-sm ${message.includes("Error") ? "text-red-600" : "text-emerald-600"}`}
              >
                {message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
