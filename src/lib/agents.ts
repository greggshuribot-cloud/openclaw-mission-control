export type AgentRole =
  | "Co-Founder"
  | "PM"
  | "Developer"
  | "QA"
  | "Architect"
  | "Designer"
  | "Strategist"
  | "Marketer"
  | "Growth"
  | "Accountant"
  | "Legal"
  | "HR";

export type AgentStatus = "Idle" | "Working" | "Blocked" | "Waiting";

export type AgentLocation =
  | "Desk"
  | "ServerRoom"
  | "Whiteboard"
  | "Watercooler"
  | "Library"
  | "Mailroom"
  | "Outbox"
  | "BreakRoom"
  | "Conference";

export type Agent = {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  location: AgentLocation;
  x: number;
  y: number;
};

export const INITIAL_AGENTS: Agent[] = [
  { id: "a1", role: "Co-Founder", status: "Working", location: "Whiteboard", x: 260, y: 130 },
  { id: "a2", role: "PM", status: "Working", location: "Whiteboard", x: 320, y: 160 },
  { id: "a3", role: "Developer", status: "Working", location: "ServerRoom", x: 540, y: 120 },
  { id: "a4", role: "QA", status: "Working", location: "ServerRoom", x: 600, y: 160 },
  { id: "a5", role: "Architect", status: "Working", location: "Whiteboard", x: 220, y: 180 },
  { id: "a6", role: "Designer", status: "Idle", location: "Desk", x: 140, y: 340 },
  { id: "a7", role: "Strategist", status: "Working", location: "Library", x: 760, y: 140 },
  { id: "a8", role: "Marketer", status: "Working", location: "Mailroom", x: 780, y: 360 },
  { id: "a9", role: "Growth", status: "Working", location: "Mailroom", x: 720, y: 340 },
  { id: "a10", role: "Accountant", status: "Idle", location: "BreakRoom", x: 500, y: 360 },
  { id: "a11", role: "Legal", status: "Working", location: "Library", x: 700, y: 180 },
  { id: "a12", role: "HR", status: "Idle", location: "BreakRoom", x: 560, y: 390 },
];
