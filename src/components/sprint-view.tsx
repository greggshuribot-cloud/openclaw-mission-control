"use client";

import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";

const nodes: Node[] = [
  { id: "1", position: { x: 0, y: 40 }, data: { label: "PRD ingestion" }, type: "input" },
  { id: "2", position: { x: 220, y: 40 }, data: { label: "Office tab (PixiJS)" } },
  { id: "3", position: { x: 220, y: 150 }, data: { label: "Dispatch tab" } },
  { id: "4", position: { x: 460, y: 95 }, data: { label: "Founder approval gate" }, type: "output" },
];

const edges: Edge[] = [
  { id: "e1-2", source: "1", target: "2" },
  { id: "e1-3", source: "1", target: "3" },
  { id: "e2-4", source: "2", target: "4" },
  { id: "e3-4", source: "3", target: "4" },
];

export function SprintView() {
  return (
    <div className="h-[440px] rounded-xl border border-zinc-800 bg-zinc-950 p-2">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}
