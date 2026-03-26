"use client";

import { QRCodeSVG } from "qrcode.react";
import { Printer, Users } from "lucide-react";

interface Room {
  id: string;
  name: string;
  slug: string;
  iconText: string;
  capacity: number | null;
}

export function QRCodeGrid({
  rooms,
  orgSlug,
  orgName,
}: {
  rooms: Room[];
  orgSlug: string;
  orgName: string;
}) {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  function printAll() {
    window.print();
  }

  if (rooms.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <p className="text-slate-500">No active rooms. Add rooms first, then generate QR codes.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4 print:hidden">
        <button
          onClick={printAll}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all"
        >
          <Printer className="w-4 h-4" />
          Print All QR Codes
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-8">
        {rooms.map((room) => {
          const url = `${baseUrl}/status/${orgSlug}/${room.slug}`;
          return (
            <div
              key={room.id}
              className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm print:border-2 print:border-slate-300 print:rounded-none print:shadow-none print:break-inside-avoid"
            >
              <div className="mb-4">
                <QRCodeSVG
                  value={url}
                  size={180}
                  level="M"
                  className="mx-auto"
                />
              </div>

              <h3 className="text-lg font-bold text-slate-900">{room.name}</h3>
              {room.capacity && (
                <p className="flex items-center justify-center gap-1 text-xs text-slate-400 mt-1">
                  <Users className="w-3 h-3" />
                  Capacity: {room.capacity}
                </p>
              )}

              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                  Scan to check availability & book
                </p>
                <p className="text-xs text-slate-300 mt-1">{orgName}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
