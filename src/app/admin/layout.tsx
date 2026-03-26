import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, Shield } from "lucide-react";

export default async function SystemAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.isSystemAdmin) {
    redirect("/");
  }

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <Calendar className="w-4 h-4 text-white" />
            </div>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-slate-900">System Administration</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">{user.email}</span>
          <Link href="/" className="text-slate-400 hover:text-slate-600 transition-colors">
            Back to home
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
