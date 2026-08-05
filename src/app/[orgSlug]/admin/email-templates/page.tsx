import { prisma } from "@/lib/prisma";
import { requireOrgRole } from "@/lib/session";
import { redirect } from "next/navigation";
import { EmailTemplatesManager } from "./templates-manager";

export default async function EmailTemplatesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) redirect("/");

  await requireOrgRole(org.id, ["ADMIN"]);

  // Get all template definitions
  const templates = await prisma.emailTemplate.findMany({
    include: {
      organizations: {
        where: { organizationId: org.id },
      },
    },
    orderBy: { slug: "asc" },
  });

  const templateData = templates.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    subject: t.organizations[0]?.subject || "",
    bodyHtml: t.organizations[0]?.bodyHtml || "",
    active: t.organizations[0]?.active ?? true,
    hasOverride: t.organizations.length > 0,
  }));

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Email Templates
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Customize email templates for your organization. Leave blank to use the
        default template. Templates support merge fields like{" "}
        <code className="bg-slate-100 px-1 rounded">{"{{eventTitle}}"}</code>,{" "}
        <code className="bg-slate-100 px-1 rounded">{"{{roomName}}"}</code>,{" "}
        <code className="bg-slate-100 px-1 rounded">{"{{startDate}}"}</code>,{" "}
        <code className="bg-slate-100 px-1 rounded">{"{{startTime}}"}</code>,{" "}
        <code className="bg-slate-100 px-1 rounded">{"{{contactName}}"}</code>,{" "}
        <code className="bg-slate-100 px-1 rounded">
          {"{{organizationName}}"}
        </code>
        .
      </p>
      <EmailTemplatesManager
        templates={templateData}
        orgId={org.id}
        orgSlug={orgSlug}
      />
    </div>
  );
}
