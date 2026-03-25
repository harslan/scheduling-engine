import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ChatInterface } from "./chat-interface";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) notFound();

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">AI Booking Assistant</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ask me to book a {org.roomTerm.toLowerCase()}, check availability, or manage your {org.eventPluralTerm.toLowerCase()}.
        </p>
      </div>
      <ChatInterface
        organizationId={org.id}
        orgSlug={orgSlug}
        roomTerm={org.roomTerm}
      />
    </div>
  );
}
