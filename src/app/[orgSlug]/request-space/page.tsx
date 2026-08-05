import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { RequestSpaceForm } from "./form";

export default async function RequestSpacePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) redirect("/");
  if (!org.allowsRoomRequests) redirect(`/${orgSlug}`);

  const session = await getSession();
  const user = session?.user as { name?: string; email?: string } | null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Request a Space
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Submit a request for a room or space. An administrator will review your
        request and assign an available room.
      </p>
      <RequestSpaceForm
        organizationId={org.id}
        orgSlug={orgSlug}
        defaultContactName={user?.name || ""}
        defaultContactEmail={user?.email || ""}
      />
    </div>
  );
}
