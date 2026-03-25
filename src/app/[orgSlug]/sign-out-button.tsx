"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton({ orgSlug }: { orgSlug: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: `/${orgSlug}` })}
      className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
      title="Sign out"
    >
      <LogOut className="w-4 h-4" />
      <span className="hidden lg:inline">Sign out</span>
    </button>
  );
}
