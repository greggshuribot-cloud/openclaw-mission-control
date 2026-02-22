"use client";

import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { useMissionControlStore } from "@/store/mission-control";
import type { Agent, AgentLocation } from "@/lib/agents";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 440;
const ANIM_DURATION = 600; // ms
const DRAG_THRESHOLD = 5; // px — below this, treat as a click not a drag

const zones = [
  { x: 20, y: 20, w: 220, h: 180, label: "Workstations" },
  { x: 250, y: 20, w: 220, h: 180, label: "Whiteboard" },
  { x: 480, y: 20, w: 180, h: 180, label: "Server Room" },
  { x: 670, y: 20, w: 210, h: 180, label: "Library" },
  { x: 20, y: 220, w: 420, h: 200, label: "Conference" },
  { x: 450, y: 220, w: 220, h: 200, label: "Break Room" },
  { x: 680, y: 220, w: 200, h: 200, label: "Mailroom / Outbox" },
];

const zoneToLocation: Record<string, AgentLocation> = {
  Workstations: "Desk",
  Whiteboard: "Whiteboard",
  "Server Room": "ServerRoom",
  Library: "Library",
  Conference: "Conference",
  "Break Room": "BreakRoom",
  "Mailroom / Outbox": "Mailroom",
};

type ZoneDef = (typeof zones)[number];

function statusColor(status: string): number {
  if (status === "Blocked") return 0xef4444;
  if (status === "Idle") return 0x94a3b8;
  return 0x22c55e;
}

function getZoneForPosition(x: number, y: number): string | null {
  for (const zone of zones) {
    if (x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h) {
      return zone.label;
    }
  }
  return null;
}

function drawZoneBg(
  g: PIXI.Graphics,
  zone: ZoneDef,
  isHovered: boolean,
  isSelected: boolean,
) {
  g.clear();
  const fillAlpha = isHovered || isSelected ? 0.5 : 0.3;
  const strokeColor = isSelected ? 0x3b82f6 : isHovered ? 0x475569 : 0x334155;
  const strokeWidth = isSelected ? 2 : 1;
  g.roundRect(zone.x, zone.y, zone.w, zone.h, 8);
  g.fill({ color: 0x1e293b, alpha: fillAlpha });
  g.stroke({ color: strokeColor, width: strokeWidth });
}

type AgentState = {
  container: PIXI.Container;
  circle: PIXI.Graphics;
  selectionRing: PIXI.Graphics;
  displayX: number;
  displayY: number;
  targetX: number;
  targetY: number;
  animStart: number;
  isDragging: boolean;
};

type DragState = {
  agentId: string;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
};

type SelectedAgent = {
  id: string;
  role: string;
  status: string;
  location: string;
};

type SelectedZone = {
  label: string;
  agents: Array<{ id: string; role: string; status: string }>;
};

export function OfficeCanvasPixi() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const agentStatesRef = useRef<Map<string, AgentState>>(new Map());
  const lightingContainerRef = useRef<PIXI.Container | null>(null);
  const initializedRef = useRef(false);
  const zoneGraphicsRef = useRef<Map<string, PIXI.Graphics>>(new Map());
  const agentsRef = useRef<Agent[]>([]);
  const selectedAgentIdRef = useRef<string | null>(null);
  const selectedZoneLabelRef = useRef<string | null>(null);
  const hoveredZoneLabelRef = useRef<string | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  // Stable ref for store action (captured once in init, but store actions are stable)
  const updateAgentPositionRef = useRef<
    (id: string, x: number, y: number, loc?: AgentLocation) => void
  >(() => {});

  const [selectedAgent, setSelectedAgent] = useState<SelectedAgent | null>(null);
  const [selectedZone, setSelectedZone] = useState<SelectedZone | null>(null);

  const { agents, officeLightingFactor, tick, updateAgentPosition } = useMissionControlStore();

  // Keep refs in sync with latest values
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    updateAgentPositionRef.current = updateAgentPosition;
  }, [updateAgentPosition]);

  // ── Initialize PixiJS app ──────────────────────────────────────────────────
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

      // ── Stage-level event handlers ─────────────────────────────────────────
      app.stage.eventMode = "static";
      app.stage.hitArea = new PIXI.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Clear all selections when clicking empty canvas
      app.stage.on("click", () => {
        // Deselect zone
        if (selectedZoneLabelRef.current) {
          const prevG = zoneGraphicsRef.current.get(selectedZoneLabelRef.current);
          const prevZone = zones.find((z) => z.label === selectedZoneLabelRef.current);
          if (prevG && prevZone) drawZoneBg(prevG, prevZone, false, false);
          selectedZoneLabelRef.current = null;
        }
        // Deselect agent
        if (selectedAgentIdRef.current) {
          const prevState = agentStatesRef.current.get(selectedAgentIdRef.current);
          if (prevState) prevState.selectionRing.clear();
          selectedAgentIdRef.current = null;
        }
        setSelectedAgent(null);
        setSelectedZone(null);
      });

      // Drag: move agent with pointer
      app.stage.on("pointermove", (event) => {
        const drag = dragStateRef.current;
        if (!drag) return;
        const state = agentStatesRef.current.get(drag.agentId);
        if (!state) return;
        state.container.x = event.global.x - drag.offsetX;
        state.container.y = event.global.y - drag.offsetY;
      });

      const endDrag = () => {
        const drag = dragStateRef.current;
        if (!drag) return;
        const state = agentStatesRef.current.get(drag.agentId);
        if (state) {
          state.isDragging = false;
          const newX = state.container.x;
          const newY = state.container.y;
          const dx = newX - drag.startX;
          const dy = newY - drag.startY;

          // Only commit if actually dragged (not a click)
          if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
            state.displayX = newX;
            state.displayY = newY;
            state.targetX = newX;
            state.targetY = newY;
            const zoneName = getZoneForPosition(newX, newY);
            const location = zoneName ? zoneToLocation[zoneName] : undefined;
            updateAgentPositionRef.current(drag.agentId, newX, newY, location);
          }
          // Reset scale after drag
          state.container.scale.set(1.0);
        }
        dragStateRef.current = null;
        app.canvas.style.cursor = "";
      };

      app.stage.on("pointerup", endDrag);
      app.stage.on("pointerupoutside", endDrag);

      // ── Zone backgrounds ───────────────────────────────────────────────────
      for (const zone of zones) {
        const g = new PIXI.Graphics();
        drawZoneBg(g, zone, false, false);
        g.eventMode = "static";
        g.cursor = "pointer";

        g.on("pointerover", () => {
          hoveredZoneLabelRef.current = zone.label;
          drawZoneBg(g, zone, true, selectedZoneLabelRef.current === zone.label);
        });

        g.on("pointerout", () => {
          if (hoveredZoneLabelRef.current === zone.label) {
            hoveredZoneLabelRef.current = null;
          }
          drawZoneBg(g, zone, false, selectedZoneLabelRef.current === zone.label);
        });

        g.on("click", (event) => {
          event.stopPropagation();

          // Deselect previous zone
          if (selectedZoneLabelRef.current && selectedZoneLabelRef.current !== zone.label) {
            const prevG = zoneGraphicsRef.current.get(selectedZoneLabelRef.current);
            const prevZone = zones.find((z) => z.label === selectedZoneLabelRef.current);
            if (prevG && prevZone) drawZoneBg(prevG, prevZone, false, false);
          }

          // Deselect agent
          if (selectedAgentIdRef.current) {
            const prevState = agentStatesRef.current.get(selectedAgentIdRef.current);
            if (prevState) prevState.selectionRing.clear();
            selectedAgentIdRef.current = null;
          }

          selectedZoneLabelRef.current = zone.label;
          drawZoneBg(g, zone, hoveredZoneLabelRef.current === zone.label, true);

          const agentsInZone = agentsRef.current.filter(
            (a) => getZoneForPosition(a.x, a.y) === zone.label,
          );

          setSelectedAgent(null);
          setSelectedZone({
            label: zone.label,
            agents: agentsInZone.map((a) => ({ id: a.id, role: a.role, status: a.status })),
          });
        });

        lightingContainer.addChild(g);
        zoneGraphicsRef.current.set(zone.label, g);

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
        label.eventMode = "none"; // pass events through to zone bg
        lightingContainer.addChild(label);
      }

      // ── Ticker: smooth agent movement ──────────────────────────────────────
      app.ticker.add(() => {
        const now = performance.now();
        agentStatesRef.current.forEach((state) => {
          if (state.isDragging) return; // position controlled by drag
          const elapsed = now - state.animStart;
          const progress = Math.min(elapsed / ANIM_DURATION, 1);
          const eased = 1 - (1 - progress) ** 2; // ease-out quadratic
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
      zoneGraphicsRef.current.clear();
      dragStateRef.current = null;
      if (appRef.current) {
        appRef.current.canvas?.remove();
        appRef.current.destroy();
        appRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update agent sprites on store change ───────────────────────────────────
  useEffect(() => {
    const lightingContainer = lightingContainerRef.current;
    if (!lightingContainer) return;

    const now = performance.now();
    const existingIds = new Set(agentStatesRef.current.keys());

    for (const agent of agents) {
      const existing = agentStatesRef.current.get(agent.id);

      if (existing) {
        existingIds.delete(agent.id);

        // Skip position update while agent is being dragged
        if (!existing.isDragging) {
          existing.displayX = existing.container.x;
          existing.displayY = existing.container.y;
          existing.targetX = agent.x;
          existing.targetY = agent.y;
          existing.animStart = now;
        }

        // Update status color
        existing.circle.clear();
        existing.circle.circle(0, 0, 6);
        existing.circle.fill({ color: statusColor(agent.status) });
      } else {
        // ── Create new agent container ───────────────────────────────────────
        const container = new PIXI.Container();
        container.x = agent.x;
        container.y = agent.y;
        container.eventMode = "static";
        container.cursor = "pointer";

        // Selection ring sits behind the dot
        const selectionRing = new PIXI.Graphics();
        container.addChild(selectionRing);

        const circle = new PIXI.Graphics();
        circle.circle(0, 0, 6);
        circle.fill({ color: statusColor(agent.status) });
        container.addChild(circle);

        const labelText = new PIXI.Text({
          text: agent.role,
          style: {
            fontSize: 10,
            fill: 0xe2e8f0,
            fontFamily: "Inter, system-ui, sans-serif",
          },
        });
        labelText.anchor.set(0.5, 0);
        labelText.y = 8;
        container.addChild(labelText);

        const agentId = agent.id;

        // Hover: scale up
        container.on("pointerover", () => {
          if (!dragStateRef.current) {
            container.scale.set(1.15);
          }
        });
        container.on("pointerout", () => {
          if (!dragStateRef.current) {
            container.scale.set(1.0);
          }
        });

        // Click: select agent
        container.on("click", (event) => {
          event.stopPropagation();

          // Deselect previous agent
          if (selectedAgentIdRef.current && selectedAgentIdRef.current !== agentId) {
            const prevState = agentStatesRef.current.get(selectedAgentIdRef.current);
            if (prevState) prevState.selectionRing.clear();
          }

          // Deselect zone
          if (selectedZoneLabelRef.current) {
            const prevG = zoneGraphicsRef.current.get(selectedZoneLabelRef.current);
            const prevZone = zones.find((z) => z.label === selectedZoneLabelRef.current);
            if (prevG && prevZone) drawZoneBg(prevG, prevZone, false, false);
            selectedZoneLabelRef.current = null;
          }

          selectedAgentIdRef.current = agentId;

          // Draw glow ring
          selectionRing.clear();
          selectionRing.circle(0, 0, 9);
          selectionRing.stroke({ color: 0x60a5fa, width: 2 });

          const current = agentsRef.current.find((a) => a.id === agentId);
          if (!current) return;

          setSelectedZone(null);
          setSelectedAgent({
            id: current.id,
            role: current.role,
            status: current.status,
            location: current.location,
          });
        });

        // Drag: start
        container.on("pointerdown", (event) => {
          const state = agentStatesRef.current.get(agentId);
          if (!state) return;
          state.isDragging = true;
          dragStateRef.current = {
            agentId,
            offsetX: event.global.x - state.container.x,
            offsetY: event.global.y - state.container.y,
            startX: state.container.x,
            startY: state.container.y,
          };
          if (appRef.current) {
            appRef.current.canvas.style.cursor = "grabbing";
          }
        });

        lightingContainer.addChild(container);
        agentStatesRef.current.set(agent.id, {
          container,
          circle,
          selectionRing,
          displayX: agent.x,
          displayY: agent.y,
          targetX: agent.x,
          targetY: agent.y,
          animStart: now,
          isDragging: false,
        });
      }
    }

    // Remove agents no longer in store
    for (const id of existingIds) {
      const state = agentStatesRef.current.get(id);
      if (state) {
        lightingContainer.removeChild(state.container);
        state.container.destroy({ children: true });
        agentStatesRef.current.delete(id);
      }
    }
  }, [agents]);

  // ── Apply office lighting ──────────────────────────────────────────────────
  useEffect(() => {
    if (lightingContainerRef.current) {
      lightingContainerRef.current.alpha = 0.25 + officeLightingFactor * 0.75;
    }
  }, [officeLightingFactor]);

  // ── Tick interval ──────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => tick(), 900);
    return () => clearInterval(id);
  }, [tick]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-4">
      {/* Zone Info Panel — left */}
      <div
        className={`w-56 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all duration-200 ${
          selectedZone
            ? "translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-2 opacity-0"
        }`}
      >
        {selectedZone && (
          <>
            <h3 className="font-semibold text-zinc-100">{selectedZone.label}</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {selectedZone.agents.length} agent
              {selectedZone.agents.length !== 1 ? "s" : ""}
            </p>
            <ul className="mt-3 space-y-2">
              {selectedZone.agents.length === 0 ? (
                <li className="text-sm text-zinc-500">No agents in this zone</li>
              ) : (
                selectedZone.agents.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        a.status === "Blocked"
                          ? "bg-red-500"
                          : a.status === "Idle"
                            ? "bg-slate-400"
                            : "bg-green-500"
                      }`}
                    />
                    <span className="text-zinc-300">{a.role}</span>
                    <span className="ml-auto text-xs text-zinc-500">{a.status}</span>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>

      {/* Canvas */}
      <div className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
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

      {/* Agent Info Panel — right */}
      <div
        className={`w-56 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all duration-200 ${
          selectedAgent
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-2 opacity-0"
        }`}
      >
        {selectedAgent && (
          <>
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  selectedAgent.status === "Blocked"
                    ? "bg-red-500"
                    : selectedAgent.status === "Idle"
                      ? "bg-slate-400"
                      : "bg-green-500"
                }`}
              />
              <h3 className="font-semibold text-zinc-100">{selectedAgent.role}</h3>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Status</dt>
                <dd className="text-zinc-200">{selectedAgent.status}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Location</dt>
                <dd className="text-zinc-200">{selectedAgent.location}</dd>
              </div>
            </dl>
            <button className="mt-4 w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Assign Task
            </button>
          </>
        )}
      </div>
    </div>
  );
}
