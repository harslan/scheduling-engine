export default async function SubmitEventPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  await params;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Submit Event</h1>
      <p className="text-sm text-slate-500 mb-8">
        Fill out the form below to request a room booking.
      </p>

      <form className="space-y-6">
        {/* Event Details */}
        <Section title="Event Details">
          <Field label="Event Title">
            <input
              type="text"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
              placeholder="e.g., Faculty Meeting"
            />
          </Field>
          <Field label="Event Type">
            <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all">
              <option value="">Select type...</option>
              <option>Meeting</option>
              <option>Class</option>
              <option>Workshop</option>
              <option>Conference</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date & Time">
              <input
                type="datetime-local"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
              />
            </Field>
            <Field label="End Date & Time">
              <input
                type="datetime-local"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
              />
            </Field>
          </div>
          <Field label="Expected Attendees">
            <input
              type="number"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
              placeholder="Number of attendees"
            />
          </Field>
        </Section>

        {/* Room Selection */}
        <Section title="Room">
          <Field label="Select Room">
            <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all">
              <option value="">Choose a room...</option>
            </select>
          </Field>
        </Section>

        {/* Contact Information */}
        <Section title="Contact Information">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name">
              <input
                type="text"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
                placeholder="Your name"
              />
            </Field>
            <Field label="Contact Email">
              <input
                type="email"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
                placeholder="you@example.com"
              />
            </Field>
          </div>
          <Field label="Additional Notes">
            <textarea
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all resize-y"
              placeholder="Any special requirements..."
            />
          </Field>
        </Section>

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-primary text-white py-3 rounded-xl text-lg font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25"
        >
          Submit Event
        </button>
      </form>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-5 border-l-3 border-primary pl-3">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
