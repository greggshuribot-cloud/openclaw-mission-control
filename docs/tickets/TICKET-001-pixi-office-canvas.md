# TICKET-001: PixiJS Office Canvas Rendering Upgrade

**Status:** Ready for Implementation  
**Priority:** High  
**Milestone:** 4 - PixiJS rendering upgrade for office canvas  
**Created:** 2026-02-22  
**Assigned To:** Claude Code

---

## Overview

Replace the current HTML/CSS-based office canvas (`src/components/office-view.tsx`) with PixiJS for performant 2D rendering. The current implementation uses simple positioned divs—this upgrade will enable smooth animations, better visuals, and scalable rendering for the virtual office environment.

---

## Current Implementation

**File:** `src/components/office-view.tsx`

- Uses CSS-positioned divs for zones (Workstations, Whiteboard, Server Room, etc.)
- Agent dots rendered as simple colored divs (3x3px)
- Office lighting controlled via CSS opacity (`lightAlpha`)
- 900ms tick interval for state updates
- Static zone layout with hardcoded positions

**Limitations:**
- No smooth animations for agent movement
- Limited visual fidelity
- Difficult to add complex rendering (paths, effects, etc.)
- Doesn't scale well for larger office spaces or more agents

---

## Requirements

### 1. PixiJS Integration

- Install PixiJS: `npm install pixi.js`
- Create new `OfficeCanvasPixi` component
- Initialize PixiJS Application with transparent background
- Size: 900x440px (matches current canvas)
- Maintain existing Zustand store integration

### 2. Zone Rendering

Current zones (preserve exact layout):
```typescript
const zones = [
  { x: 20, y: 20, w: 220, h: 180, label: "Workstations" },
  { x: 250, y: 20, w: 220, h: 180, label: "Whiteboard" },
  { x: 480, y: 20, w: 180, h: 180, label: "Server Room" },
  { x: 670, y: 20, w: 210, h: 180, label: "Library" },
  { x: 20, y: 220, w: 420, h: 200, label: "Conference" },
  { x: 450, y: 220, w: 220, h: 200, label: "Break Room" },
  { x: 680, y: 220, w: 200, h: 200, label: "Mailroom / Outbox" },
];
```

**Render zones as:**
- Rounded rectangles with border
- Fill: semi-transparent (`bg-slate-800/30` equivalent)
- Border: `border-slate-700` equivalent
- Zone labels rendered as PIXI.Text inside each zone
- Font: 12px, color: `text-slate-300`

### 3. Agent Rendering

**Agent sprites/dots:**
- Render agents as circles (6px diameter, 2x current size for better visibility)
- Status colors:
  - **Blocked:** Red (`#ef4444`)
  - **Idle:** Gray (`#94a3b8`)
  - **Working:** Green (`#22c55e`)
- Agent role label below each dot (10px font, `text-slate-200`)

**Agent movement:**
- Smooth animated transitions when agent `x, y` changes
- Use PIXI.Ticker for smooth interpolation
- Transition duration: ~600ms ease-out

### 4. Office Lighting

- Apply global alpha/tint based on `officeLightingFactor` from Zustand store
- Formula: `alpha = 0.25 + officeLightingFactor * 0.75`
- Affects entire canvas container

### 5. Responsive & Performance

- Handle canvas resize gracefully
- Dispose PixiJS resources on component unmount
- Maintain 60fps rendering
- Keep tick interval at 900ms (no change)

---

## Technical Approach

### Component Structure

```typescript
// src/components/office-canvas-pixi.tsx
"use client";

import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { useMissionControlStore } from "@/store/mission-control";

export function OfficeCanvasPixi() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const { agents, officeLightingFactor, tick } = useMissionControlStore();

  // Initialize PixiJS app
  useEffect(() => {
    // Create app, setup zones, setup agents
    // Return cleanup function
  }, []);

  // Update agents on state change
  useEffect(() => {
    // Animate agent positions & status colors
  }, [agents]);

  // Update lighting
  useEffect(() => {
    // Apply alpha to container
  }, [officeLightingFactor]);

  // Tick interval (unchanged)
  useEffect(() => {
    const id = setInterval(() => tick(), 900);
    return () => clearInterval(id);
  }, [tick]);

  return <div ref={canvasRef} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3" />;
}
```

### Integration Steps

1. Install PixiJS dependency
2. Create `src/components/office-canvas-pixi.tsx`
3. Implement zone rendering (Graphics API)
4. Implement agent rendering (Graphics + Text)
5. Add smooth agent movement (Ticker + tweening)
6. Apply office lighting via Container alpha
7. Replace `OfficeView` usage in main app with `OfficeCanvasPixi`
8. Test with various agent states and treasury lighting scenarios
9. Add zone legend below canvas (keep existing grid)

---

## Acceptance Criteria

- [ ] PixiJS renders zones with correct positions, sizes, labels
- [ ] Agents render as colored dots with role labels
- [ ] Agent movement animates smoothly (600ms transitions)
- [ ] Agent status colors update correctly (Blocked/Idle/Working)
- [ ] Office lighting dimming works based on `officeLightingFactor`
- [ ] Canvas maintains 60fps rendering
- [ ] Component properly cleans up PixiJS resources on unmount
- [ ] Visual appearance matches or improves upon current CSS version
- [ ] Zone legend grid below canvas preserved
- [ ] No regressions in agent state updates or Zustand integration

---

## Testing Scenarios

1. **Agent Movement:** Create agents and manually update their `x, y` coordinates in store → smooth animation
2. **Status Changes:** Toggle agent status → color updates immediately
3. **Treasury Impact:** Adjust treasury burn rate → office lighting dims/brightens correctly
4. **Multiple Agents:** Add 10+ agents → rendering stays smooth
5. **Unmount:** Navigate away from Office tab → PixiJS resources cleaned up (no memory leaks)

---

## Dependencies

- `pixi.js` (latest stable, currently v8.x)
- Existing Zustand store (`@/store/mission-control`)
- Existing zone data structure

---

## Files to Create/Modify

**Create:**
- `src/components/office-canvas-pixi.tsx`

**Modify:**
- `src/app/page.tsx` (or wherever `OfficeView` is imported) - replace with `OfficeCanvasPixi`
- `package.json` - add `pixi.js` dependency

**Optional:**
- Add `src/lib/pixi-helpers.ts` for reusable zone/agent rendering utilities

---

## Notes for Claude Code

- Use PixiJS v8.x Graphics API (simpler than legacy v7 API)
- Keep existing Zustand store contract unchanged
- Preserve exact zone coordinates (no layout changes)
- Agent movement should feel natural (ease-out interpolation)
- Test with Chrome DevTools Performance profiler to ensure 60fps
- Consider using `PIXI.Assets` if we later add sprites/textures

---

## Success Metrics

- Office canvas renders smoothly at 60fps
- Agent animations feel natural and responsive
- Code is clean, well-typed, and maintainable
- No performance degradation vs. current CSS approach
- Foundation ready for future enhancements (paths, effects, etc.)

---

**End of Ticket**
