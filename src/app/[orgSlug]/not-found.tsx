import Link from "next/link";
import { Calendar, ArrowLeft, Building2 } from "lucide-react";

export default function OrgNotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Building2 className="w-10 h-10 text-slate-300" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
          Organization not found
        </h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          This organization doesn&apos;t exist or the URL may be incorrect.
          Check the address or explore available organizations from the home page.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
      </div>
    </div>
  );
}
