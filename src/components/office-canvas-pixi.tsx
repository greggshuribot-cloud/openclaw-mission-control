"use client";

import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { useMissionControlStore } from "@/store/mission-control";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 440;
const ANIM_DURATION = 600; // ms

const zones = [
  { x: 20, y: 20, w: 220, h: 180, label: "Workstations" },
  { x: 250, y: 20, w: 220, h: 180, label: "Whiteboard" },
  { x: 480, y: 20, w: 180, h: 180, label: "Server Room" },
  { x: 670, y: 20, w: 210, h: 180, label: "Library" },
  { x: 20, y: 220, w: 420, h: 200, label: "Conference" },
  { x: 450, y: 220, w: 220, h: 200, label: "Break Room" },
  { x: 680, y: 220, w: 200, h: 200, label: "Mailroom / Outbox" },
];

function statusColor(status: string): number {
  if (status === "Blocked") return 0xef4444;
  if (status === "Idle") return 0x94a3b8;
  return 0x22c55e;
}

type AgentState = {
  container: PIXI.Container;
  circle: PIXI.Graphics;
  displayX: number;
  displayY: number;
  targetX: number;
  targetY: number;
  animStart: number;
};

export function OfficeCanvasPixi() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const agentStatesRef = useRef<Map<string, AgentState>>(new Map());
  const lightingContainerRef = useRef<PIXI.Container | null>(null);
  const initializedRef = useRef(false);

  const { agents, officeLightingFactor, tick } = useMissionControlStore();

  // Initialize PixiJS app
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || initializedRef.current) return;
    initializedRef.current = true;

    let destroyed = false;
    const app = new PIXI.Application();

    (async () => {
      await app.init({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundAlpha: 0,
        antialias: true,
      });

      if (destroyed) {
        app.destroy();
        return;
      }

      appRef.current = app;
      app.canvas.style.width = "100%";
      app.canvas.style.display = "block";
      el.appendChild(app.canvas);

      // Container for all scene elements (lighting applied here)
      const lightingContainer = new PIXI.Container();
      lightingContainer.alpha = 0.25 + officeLightingFactor * 0.75;
      app.stage.addChild(lightingContainer);
      lightingContainerRef.current = lightingContainer;

      // Render zone backgrounds
      for (const zone of zones) {
        const g = new PIXI.Graphics();
        g.roundRect(zone.x, zone.y, zone.w, zone.h, 8);
        g.fill({ color: 0x1e293b, alpha: 0.3 });
        g.stroke({ color: 0x334155, width: 1 });
        lightingContainer.addChild(g);

        const label = new PIXI.Text({
          text: zone.label,
          style: {
            fontSize: 12,
            fill: 0xcbd5e1,
            fontFamily: "Inter, system-ui, sans-serif",
          },
        });
        label.x = zone.x + 8;
        label.y = zone.y + 8;
        lightingContainer.addChild(label);
      }

      // Ticker for smooth agent movement interpolation
      app.ticker.add(() => {
        const now = performance.now();
        agentStatesRef.current.forEach((state) => {
          const elapsed = now - state.animStart;
          const progress = Math.min(elapsed / ANIM_DURATION, 1);
          // ease-out quadratic
          const eased = 1 - (1 - progress) ** 2;
          state.container.x = state.displayX + (state.targetX - state.displayX) * eased;
          state.container.y = state.displayY + (state.targetY - state.displayY) * eased;

          if (progress >= 1) {
            state.displayX = state.targetX;
            state.displayY = state.targetY;
          }
        });
      });
    })();

    return () => {
      destroyed = true;
      initializedRef.current = false;
      agentStatesRef.current.clear();
      lightingContainerRef.current = null;
      if (appRef.current) {
        appRef.current.canvas?.remove();
        appRef.current.destroy();
        appRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update agent sprites on store change
  useEffect(() => {
    const lightingContainer = lightingContainerRef.current;
    if (!lightingContainer) return;

    const now = performance.now();
    const existingIds = new Set(agentStatesRef.current.keys());

    for (const agent of agents) {
      const existing = agentStatesRef.current.get(agent.id);

      if (existing) {
        // Capture current interpolated position as new animation start
        existing.displayX = existing.container.x;
        existing.displayY = existing.container.y;
        existing.targetX = agent.x;
        existing.targetY = agent.y;
        existing.animStart = now;

        // Update status color
        existing.circle.clear();
        existing.circle.circle(0, 0, 6);
        existing.circle.fill({ color: statusColor(agent.status) });

        existingIds.delete(agent.id);
      } else {
        // Create new agent container
        const container = new PIXI.Container();
        container.x = agent.x;
        container.y = agent.y;

        const circle = new PIXI.Graphics();
        circle.circle(0, 0, 6);
        circle.fill({ color: statusColor(agent.status) });
        container.addChild(circle);

        const label = new PIXI.Text({
          text: agent.role,
          style: {
            fontSize: 10,
            fill: 0xe2e8f0,
            fontFamily: "Inter, system-ui, sans-serif",
          },
        });
        label.anchor.set(0.5, 0);
        label.y = 8;
        container.addChild(label);

        lightingContainer.addChild(container);
        agentStatesRef.current.set(agent.id, {
          container,
          circle,
          displayX: agent.x,
          displayY: agent.y,
          targetX: agent.x,
          targetY: agent.y,
          animStart: now,
        });
      }
    }

    // Remove agents no longer in the store
    for (const id of existingIds) {
      const state = agentStatesRef.current.get(id);
      if (state) {
        lightingContainer.removeChild(state.container);
        state.container.destroy({ children: true });
        agentStatesRef.current.delete(id);
      }
    }
  }, [agents]);

  // Apply office lighting
  useEffect(() => {
    if (lightingContainerRef.current) {
      lightingContainerRef.current.alpha = 0.25 + officeLightingFactor * 0.75;
    }
  }, [officeLightingFactor]);

  // Tick interval (unchanged from original)
  useEffect(() => {
    const id = setInterval(() => tick(), 900);
    return () => clearInterval(id);
  }, [tick]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <div
        ref={canvasRef}
        className="overflow-hidden rounded-lg border border-zinc-800 bg-slate-950"
        style={{ height: CANVAS_HEIGHT }}
      />
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
