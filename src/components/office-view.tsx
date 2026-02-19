"use client";

import { useEffect } from "react";
import { useMissionControlStore } from "@/store/mission-control";

const zones = [
  { x: 20, y: 20, w: 220, h: 180, label: "Workstations" },
  { x: 250, y: 20, w: 220, h: 180, label: "Whiteboard" },
  { x: 480, y: 20, w: 180, h: 180, label: "Server Room" },
  { x: 670, y: 20, w: 210, h: 180, label: "Library" },
  { x: 20, y: 220, w: 420, h: 200, label: "Conference" },
  { x: 450, y: 220, w: 220, h: 200, label: "Break Room" },
  { x: 680, y: 220, w: 200, h: 200, label: "Mailroom / Outbox" },
];

export function OfficeView() {
  const { agents, officeLightingFactor, tick } = useMissionControlStore();

  useEffect(() => {
    const id = setInterval(() => tick(), 900);
    return () => clearInterval(id);
  }, [tick]);

  const lightAlpha = 0.25 + officeLightingFactor * 0.75;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <div
        className="relative h-[440px] w-full overflow-hidden rounded-lg border border-zinc-800 bg-slate-950"
        style={{ opacity: lightAlpha }}
      >
        {zones.map((z) => (
          <div
            key={z.label}
            className="absolute rounded-lg border border-slate-700 bg-slate-800/30 p-2 text-xs text-slate-300"
            style={{ left: z.x, top: z.y, width: z.w, height: z.h }}
          >
            {z.label}
          </div>
        ))}

        {agents.map((a) => (
          <div
            key={a.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: a.x, top: a.y }}
          >
            <div
              className={`h-3 w-3 rounded-full ${
                a.status === "Blocked"
                  ? "bg-red-500"
                  : a.status === "Idle"
                    ? "bg-slate-400"
                    : "bg-green-500"
              }`}
            />
            <div className="mt-1 text-[10px] text-slate-200">{a.role}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400 md:grid-cols-4">
        {zones.map((z) => (
          <div key={z.label} className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1">
            {z.label}
          </div>
        ))}
      </div>
    </div>
  );
}
