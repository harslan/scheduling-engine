import { Building2, Calendar, Users, Shield, Mail, Palette } from "lucide-react";
import Link from "next/link";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">
        Administration
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Manage your organization settings, rooms, and users.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AdminCard
          href={`/${orgSlug}/admin/organization`}
          icon={<Building2 className="w-5 h-5" />}
          title="Organization"
          description="Name, display settings, and feature flags"
        />
        <AdminCard
          href={`/${orgSlug}/admin/rooms`}
          icon={<Calendar className="w-5 h-5" />}
          title="Rooms"
          description="Manage rooms, configurations, and availability"
        />
        <AdminCard
          href={`/${orgSlug}/admin/users`}
          icon={<Users className="w-5 h-5" />}
          title="Users"
          description="Manage users and role assignments"
        />
        <AdminCard
          href={`/${orgSlug}/admin/approval`}
          icon={<Shield className="w-5 h-5" />}
          title="Approval"
          description="Approval workflow and approver settings"
        />
        <AdminCard
          href={`/${orgSlug}/admin/emails`}
          icon={<Mail className="w-5 h-5" />}
          title="Email Templates"
          description="Customize notification emails"
        />
        <AdminCard
          href={`/${orgSlug}/admin/branding`}
          icon={<Palette className="w-5 h-5" />}
          title="Branding"
          description="Logo, colors, and look & feel"
        />
      </div>
    </div>
  );
}

function AdminCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-primary/20 transition-all group"
    >
      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-3 group-hover:bg-primary group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500">{description}</p>
    </Link>
  );
}
