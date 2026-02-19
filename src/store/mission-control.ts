"use client";

import { create } from "zustand";
import { Agent, INITIAL_AGENTS } from "@/lib/agents";

type MissionControlState = {
  agents: Agent[];
  burnRatePct: number;
  officeLightingFactor: number;
  meetingMode: boolean;
  tick: () => void;
  triggerMeeting: () => void;
  setTreasuryTelemetry: (input: { burnRatePct: number; officeLightingFactor: number }) => void;
};

export const useMissionControlStore = create<MissionControlState>((set, get) => ({
  agents: INITIAL_AGENTS,
  burnRatePct: 74,
  officeLightingFactor: 0.74,
  meetingMode: false,
  tick: () => {
    if (get().meetingMode) return;
    set((state) => ({
      agents: state.agents.map((a) => ({
        ...a,
        x: a.x + (Math.random() * 2 - 1),
        y: a.y + (Math.random() * 2 - 1),
      })),
    }));
  },
  triggerMeeting: () =>
    set((state) => ({
      meetingMode: !state.meetingMode,
      agents: state.agents.map((a, idx) => ({
        ...a,
        location: state.meetingMode ? a.location : "Conference",
        x: state.meetingMode ? a.x : 360 + (idx % 6) * 45,
        y: state.meetingMode ? a.y : 250 + Math.floor(idx / 6) * 45,
      })),
    })),
  setTreasuryTelemetry: ({ burnRatePct, officeLightingFactor }) => {
    set({
      burnRatePct: Math.max(0, Math.round(burnRatePct)),
      officeLightingFactor: Math.max(0.2, Math.min(1, officeLightingFactor)),
    });
  },
}));
