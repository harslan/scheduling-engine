import Link from "next/link";
import { Calendar, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-full flex flex-col bg-white">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -inset-1 bg-primary/20 rounded-xl blur-md -z-10" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              Scheduling Engine
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 relative hero-mesh">
        <div className="absolute inset-0 hero-grid opacity-20" />

        <div className="relative flex items-center justify-center min-h-[calc(100vh-73px)] pb-20">
          <div className="text-center max-w-md px-6">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm border border-slate-200/80">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <h1 className="text-5xl font-extrabold text-slate-900 mb-3 tracking-tight">
              404
            </h1>
            <p className="text-xl font-semibold text-slate-700 mb-2">
              Page not found
            </p>
            <p className="text-slate-500 mb-8 leading-relaxed">
              The page you&apos;re looking for doesn&apos;t exist or has been
              moved. Check the URL or head back to the home page.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-blue-600 text-white px-8 py-3.5 rounded-2xl font-semibold hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
