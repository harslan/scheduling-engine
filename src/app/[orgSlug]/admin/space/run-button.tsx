"use client";

import { runSpaceAllocation } from "@/lib/actions/space";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Play } from "lucide-react";

export function RunButton({
  organizationId,
  semester,
}: {
  organizationId: string;
  semester: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.set("organizationId", organizationId);
    fd.set("semester", semester);
    const result = await runSpaceAllocation(fd);
    setLoading(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        Run allocation (simulation)
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
