# TICKET-002: Interactive Office Canvas Features

**Status:** Ready for Implementation  
**Priority:** High  
**Depends On:** TICKET-001 (PixiJS Office Canvas)  
**Created:** 2026-02-22  
**Assigned To:** Claude Code

---

## Overview

Add interactive features to the PixiJS office canvas: clickable agents with info tooltips, clickable zones that highlight and show agent lists, and drag-to-move agent functionality for the founder. Transform the static visualization into a functional office control interface.

---

## Current State

**File:** `src/components/office-canvas-pixi.tsx`

- PixiJS canvas renders 7 office zones
- Agents displayed as animated dots with labels
- Smooth 600ms movement animations
- Office lighting via Container alpha
- No interactivity (can't click anything)

---

## Requirements

### 1. Clickable Agents

**Agent Click Behavior:**
- Click an agent dot → show **Agent Info Panel** (right side of canvas)
- Panel displays:
  - Agent role
  - Current status (Idle/Working/Blocked/Waiting)
  - Current location/zone
  - Currently assigned task (if any) with link to task detail
  - "Assign Task" button
- Click another agent → panel updates
- Click empty space → panel closes
- Visual feedback: agent dot scales 1.2x on hover, border glow on selection

**Implementation:**
- Make agent containers interactive (`eventMode = 'static'`)
- Add click handlers to agent containers
- Track selected agent ID in component state
- Render info panel as React component alongside canvas

### 2. Clickable Zones

**Zone Click Behavior:**
- Click a zone → highlight zone + show **Zone Info Panel** (left side of canvas)
- Panel displays:
  - Zone name
  - List of agents currently in this zone
  - Agent count
  - Zone capacity (optional, can hardcode or leave for future)
- Highlight: zone border glows (color shift + increased width)
- Click another zone → switch highlight
- Click empty space → clear highlight and close panel

**Implementation:**
- Make zone Graphics interactive
- Add click handlers to zone backgrounds
- Track selected zone in component state
- Visual highlight via stroke color/width change

### 3. Drag-to-Move Agents (Founder Mode)

**Drag Behavior:**
- Click and hold an agent dot → enter drag mode
- Drag agent → cursor changes, agent follows (no animation, direct position)
- Release → agent snaps to new position, update Zustand store with new `(x, y)`
- Agent remembers new position in store (persists until page refresh)
- Optional: detect which zone the agent landed in and update `currentLocation` in store

**Constraints:**
- Drag should feel immediate (no 600ms animation during drag)
- After release, agent can animate smoothly if store updates again
- Only allow dragging if user is the founder (check session/auth if needed, or allow all for now)

**Implementation:**
- Add `pointerdown`, `pointermove`, `pointerup` handlers to agent containers
- Track drag state (`isDragging`, `dragOffsetX`, `dragOffsetY`)
- During drag: update agent container position directly (bypass animation)
- On release: update Zustand store with new coordinates

### 4. Visual Feedback & Polish

**Hover States:**
- Agents: scale 1.15x, cursor pointer
- Zones: subtle glow, cursor pointer
- Drag cursor: change to `move` or `grabbing`

**Selection Indicators:**
- Selected agent: glowing border around dot (2px stroke)
- Selected zone: thicker border + color shift (e.g., from `0x334155` to `0x3b82f6`)

**Smooth UX:**
- Info panels slide in from sides (CSS transitions)
- Clicking empty canvas clears all selections
- Clicking on a new agent/zone while one is selected → smoothly switches

---

## Component Structure

### Updated OfficeCanvasPixi Component

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { useMissionControlStore } from "@/store/mission-control";

type SelectedAgent = {
  id: string;
  role: string;
  status: string;
  location: string;
  assignedTask?: { id: string; title: string };
};

type SelectedZone = {
  label: string;
  agents: Array<{ id: string; role: string; status: string }>;
};

export function OfficeCanvasPixi() {
  const [selectedAgent, setSelectedAgent] = useState<SelectedAgent | null>(null);
  const [selectedZone, setSelectedZone] = useState<SelectedZone | null>(null);
  
  // ... existing refs and store hooks

  // Agent click handler
  const handleAgentClick = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    
    setSelectedAgent({
      id: agent.id,
      role: agent.role,
      status: agent.status,
      location: agent.currentLocation,
      // TODO: fetch assigned task from store
    });
    setSelectedZone(null); // Close zone panel
  };

  // Zone click handler
  const handleZoneClick = (zoneLabel: string) => {
    const agentsInZone = agents.filter(a => {
      // TODO: detect which zone the agent is in based on x,y
      return false;
    });
    
    setSelectedZone({
      label: zoneLabel,
      agents: agentsInZone,
    });
    setSelectedAgent(null); // Close agent panel
  };

  // Canvas background click (clear selections)
  const handleCanvasClick = () => {
    setSelectedAgent(null);
    setSelectedZone(null);
  };

  // ... existing PixiJS setup and effects

  return (
    <div className="flex gap-4">
      {/* Zone Info Panel (left) */}
      {selectedZone && (
        <aside className="w-64 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="font-semibold text-zinc-100">{selectedZone.label}</h3>
          <p className="mt-2 text-sm text-zinc-400">{selectedZone.agents.length} agent(s)</p>
          <ul className="mt-4 space-y-2">
            {selectedZone.agents.map(a => (
              <li key={a.id} className="text-sm text-zinc-300">
                {a.role} - {a.status}
              </li>
            ))}
          </ul>
        </aside>
      )}

      {/* Canvas */}
      <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
        <div
          ref={canvasRef}
          className="overflow-hidden rounded-lg border border-zinc-800 bg-slate-950"
          style={{ height: 440 }}
        />
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400 md:grid-cols-4">
          {/* zone legend */}
        </div>
      </div>

      {/* Agent Info Panel (right) */}
      {selectedAgent && (
        <aside className="w-64 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="font-semibold text-zinc-100">{selectedAgent.role}</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-zinc-500">Status</dt>
              <dd className="text-zinc-200">{selectedAgent.status}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Location</dt>
              <dd className="text-zinc-200">{selectedAgent.location}</dd>
            </div>
            {selectedAgent.assignedTask && (
              <div>
                <dt className="text-zinc-500">Task</dt>
                <dd className="text-zinc-200">{selectedAgent.assignedTask.title}</dd>
              </div>
            )}
          </dl>
          <button className="mt-4 w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Assign Task
          </button>
        </aside>
      )}
    </div>
  );
}
```

---

## Technical Details

### Zone Detection (for Agent Location)

Simple bounding-box check:

```typescript
function getZoneForPosition(x: number, y: number): string | null {
  for (const zone of zones) {
    if (
      x >= zone.x &&
      x <= zone.x + zone.w &&
      y >= zone.y &&
      y <= zone.y + zone.h
    ) {
      return zone.label;
    }
  }
  return null;
}
```

Use this to:
- Show which agents are in a clicked zone
- Update agent `currentLocation` when dragged to a new zone

### Drag Implementation

```typescript
// In agent setup
agentContainer.eventMode = 'static';
agentContainer.cursor = 'pointer';

agentContainer.on('pointerdown', (event) => {
  isDragging = true;
  dragTarget = agentId;
  // Calculate offset from agent center to pointer
});

app.stage.on('pointermove', (event) => {
  if (isDragging && dragTarget) {
    // Update agent container position directly
    // Skip normal animation system
  }
});

app.stage.on('pointerup', () => {
  if (isDragging && dragTarget) {
    // Update Zustand store with new x, y
    // Detect zone and update currentLocation if needed
    isDragging = false;
    dragTarget = null;
  }
});
```

### Zustand Store Update (for Agent Position)

You'll need a store action like:

```typescript
// In mission-control.ts store
updateAgentPosition: (agentId: string, x: number, y: number) => {
  set((state) => ({
    agents: state.agents.map((a) =>
      a.id === agentId ? { ...a, x, y, currentLocation: getZoneForPosition(x, y) ?? a.currentLocation } : a
    ),
  }));
}
```

---

## Acceptance Criteria

- [ ] Clicking an agent shows Agent Info Panel on the right
- [ ] Agent Info Panel displays role, status, location, and assigned task (if any)
- [ ] Clicking another agent switches the panel smoothly
- [ ] Clicking a zone shows Zone Info Panel on the left
- [ ] Zone Info Panel displays zone name and list of agents in that zone
- [ ] Clicking another zone switches the highlight and panel
- [ ] Clicking empty canvas space clears all selections and closes panels
- [ ] Agents can be dragged with mouse (click-hold-drag-release)
- [ ] Dragged agents update their position in Zustand store
- [ ] Dragged agents update `currentLocation` based on which zone they land in
- [ ] Hover feedback: agents scale 1.15x, zones glow subtly
- [ ] Selected agent has glowing border
- [ ] Selected zone has thicker + colored border
- [ ] Drag cursor changes to `move`/`grabbing`
- [ ] No regressions in existing animations, lighting, or rendering performance

---

## Testing Scenarios

1. **Agent Selection:** Click multiple agents → info panel updates correctly
2. **Zone Selection:** Click multiple zones → agents list updates correctly
3. **Zone Detection:** Drag agent to different zone → `currentLocation` updates
4. **Clear Selection:** Click empty space → all panels close
5. **Drag Performance:** Drag agent around → smooth, no lag or visual glitches
6. **Panel Layout:** Info panels don't overlap canvas, responsive on smaller screens
7. **Simultaneous Selections:** Clicking agent while zone is selected → zone panel closes, agent panel opens

---

## Optional Enhancements (Future Tickets)

- Double-click agent → jump to agent's assigned task in Current Sprint tab
- Right-click agent → context menu (Assign Task, Change Status, etc.)
- Zone click → show zone-specific actions (e.g., "Start Meeting in Conference")
- Agent tooltips on hover (lightweight, just role + status)
- Multi-select agents (Shift+Click)
- Keyboard shortcuts (Escape to clear selection)

---

## Files to Create/Modify

**Modify:**
- `src/components/office-canvas-pixi.tsx` (add interactivity + panels)
- `src/store/mission-control.ts` (add `updateAgentPosition` action)

**Optional:**
- `src/lib/zone-helpers.ts` (zone detection utility functions)

---

## Notes for Claude Code

- Keep existing animation and lighting systems intact
- Ensure drag feels responsive (don't apply 600ms animation during drag)
- Zone detection should be accurate (bounding box check)
- Info panels should be accessible and close gracefully
- Test with keyboard navigation if time permits (not required)
- Use existing Tailwind styles for consistency

---

## Success Metrics

- Office canvas is now interactive and useful for founder oversight
- Users can explore agents and zones easily
- Drag-to-move feels natural and updates state correctly
- Foundation ready for more advanced features (task assignment UI, agent automation, etc.)

---

**End of Ticket**
