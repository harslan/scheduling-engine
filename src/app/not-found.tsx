import Link from "next/link";
import { Calendar, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <header className="px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-blue-600 rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">Scheduling Engine</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center pb-20">
        <div className="text-center max-w-md px-6">
          <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <Search className="w-10 h-10 text-slate-300" />
          </div>
          <h1 className="text-5xl font-extrabold text-slate-900 mb-3">404</h1>
          <p className="text-xl font-semibold text-slate-700 mb-2">Page not found</p>
          <p className="text-slate-500 mb-8 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            Check the URL or head back to the home page.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
