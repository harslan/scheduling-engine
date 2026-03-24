"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-slate-400 hover:text-slate-600 transition-colors"
      title="Sign out"
    >
      <LogOut className="w-4 h-4" />
    </button>
  );
}
