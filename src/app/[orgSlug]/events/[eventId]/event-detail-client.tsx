"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Edit } from "lucide-react";
import { EditEventForm } from "./edit-form";

interface EventData {
  id: string;
  title: string;
  eventTypeId: string | null;
  roomId: string | null;
  startDateTime: string;
  endDateTime: string;
  expectedAttendeeCount: number | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
}

export function EditButton({
  event,
  rooms,
  eventTypes,
  orgSlug,
  orgTerms,
}: {
  event: EventData;
  rooms: { id: string; name: string }[];
  eventTypes: { id: string; name: string }[];
  orgSlug: string;
  orgTerms: { roomTerm: string; eventSingularTerm: string };
}) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);

  // Escape key to close edit panel
  useEffect(() => {
    if (!editing) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEditing(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editing]);

  // Focus the form when it opens
  useEffect(() => {
    if (editing && formRef.current) {
      const firstInput = formRef.current.querySelector<HTMLInputElement>("input, select, textarea");
      firstInput?.focus();
    }
  }, [editing]);

  if (editing) {
    return (
      <div
        ref={formRef}
        className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
        role="region"
        aria-label="Edit event"
      >
        <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-4 border-l-3 border-primary pl-3">
          Edit {orgTerms.eventSingularTerm}
        </h2>
        <EditEventForm
          event={event}
          rooms={rooms}
          eventTypes={eventTypes}
          orgSlug={orgSlug}
          orgTerms={orgTerms}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-primary border border-primary/20 rounded-lg text-sm font-medium hover:bg-primary/5 transition-colors"
    >
      <Edit className="w-3.5 h-3.5" />
      Edit
    </button>
  );
}
