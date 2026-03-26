"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Building2 } from "lucide-react";
import { createOrganization } from "@/lib/actions/system-admin";

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [slug, setSlug] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await createOrganization(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(`/${result.slug}/admin`);
    }
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  return (
    <div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-primary transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to organizations
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            New Organization
          </h1>
          <p className="text-sm text-slate-500">
            Create a new tenant with its own rooms, events, and admin
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 max-w-2xl"
      >
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Organization Details */}
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900 mb-4">
            Organization Details
          </legend>

          <div className="grid gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                Organization Name
              </label>
              <input
                id="name"
                name="name"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                placeholder="Acme University"
                onChange={(e) => {
                  const generated = generateSlug(e.target.value);
                  setSlug(generated);
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="shortName" className="block text-sm font-medium text-slate-700 mb-1">
                  Short Name
                </label>
                <input
                  id="shortName"
                  name="shortName"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                  placeholder="ACME"
                />
              </div>

              <div>
                <label htmlFor="slug" className="block text-sm font-medium text-slate-700 mb-1">
                  URL Slug
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 bg-slate-50 border border-r-0 border-slate-200 rounded-l-lg text-sm text-slate-400">
                    /
                  </span>
                  <input
                    id="slug"
                    name="slug"
                    required
                    pattern="[a-z0-9-]+"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-r-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                    placeholder="acme-university"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="appDisplayName" className="block text-sm font-medium text-slate-700 mb-1">
                Display Name <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="appDisplayName"
                name="appDisplayName"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                placeholder="ACME Room Booking"
              />
              <p className="text-xs text-slate-400 mt-1">
                Shown in the header and calendar. Falls back to Organization Name.
              </p>
            </div>

            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-slate-700 mb-1">
                Timezone
              </label>
              <select
                id="timezone"
                name="timezone"
                defaultValue="America/New_York"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
              >
                <option value="America/New_York">Eastern (America/New_York)</option>
                <option value="America/Chicago">Central (America/Chicago)</option>
                <option value="America/Denver">Mountain (America/Denver)</option>
                <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
                <option value="America/Costa_Rica">Costa Rica (America/Costa_Rica)</option>
                <option value="America/Bogota">Colombia (America/Bogota)</option>
                <option value="America/Mexico_City">Mexico City (America/Mexico_City)</option>
                <option value="America/Sao_Paulo">Sao Paulo (America/Sao_Paulo)</option>
                <option value="Europe/London">London (Europe/London)</option>
                <option value="Europe/Paris">Paris (Europe/Paris)</option>
                <option value="Europe/Berlin">Berlin (Europe/Berlin)</option>
                <option value="Asia/Tokyo">Tokyo (Asia/Tokyo)</option>
                <option value="Asia/Shanghai">Shanghai (Asia/Shanghai)</option>
                <option value="Asia/Dubai">Dubai (Asia/Dubai)</option>
                <option value="Australia/Sydney">Sydney (Australia/Sydney)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* Organization Admin */}
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900 mb-1">
            Organization Admin
          </legend>
          <p className="text-xs text-slate-400 mb-4">
            This person will manage this organization. If the email already exists, they&apos;ll be added as admin.
          </p>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="adminName" className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  id="adminName"
                  name="adminName"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label htmlFor="adminEmail" className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  id="adminEmail"
                  name="adminEmail"
                  type="email"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                  placeholder="jane@acme.edu"
                />
              </div>
            </div>

            <div>
              <label htmlFor="adminPassword" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="adminPassword"
                name="adminPassword"
                type="password"
                required
                minLength={6}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none"
                placeholder="At least 6 characters"
              />
              <p className="text-xs text-slate-400 mt-1">
                Ignored if the user already exists.
              </p>
            </div>
          </div>
        </fieldset>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin"
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Organization"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
