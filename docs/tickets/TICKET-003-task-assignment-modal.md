# TICKET-003: Task Assignment Modal

**Status:** Ready for Implementation  
**Priority:** High  
**Depends On:** TICKET-002 (Interactive Office Canvas)  
**Created:** 2026-02-22  
**Assigned To:** Claude Code

---

## Overview

Make the "Assign Task" button in the Agent Info Panel functional by implementing a task assignment modal. Allow founders to assign tasks from the Sprint backlog to agents, view agent workload, and reassign tasks - connecting Office canvas interactions to the Sprint management workflow.

---

## Current State

**File:** `src/components/office-canvas-pixi.tsx`

- Agent Info Panel shows "Assign Task" button (right side)
- Button is a placeholder - clicking does nothing
- No way to assign tasks to agents from the Office view
- Sprint view has task management, but no agent assignment UI

**File:** `src/components/sprint-view.tsx`

- Tasks display assigned agent (if any)
- No UI to assign/reassign agents
- Agent assignment happens via API but no frontend interface

---

## Requirements

### 1. Task Assignment Modal

**Trigger:**
- Click "Assign Task" button in Agent Info Panel → open modal

**Modal Content:**
- **Header:** "Assign Task to [Agent Role]"
- **Current Assignment Section:**
  - Show currently assigned task (if any)
  - Task title, status, description excerpt
  - "Unassign" button (if task exists)
- **Available Tasks Section:**
  - List of unassigned tasks from current sprint
  - Task cards showing: title, status badge, description excerpt
  - Click task card → confirm and assign
- **Search/Filter:**
  - Filter by task status (TODO, IN_PROGRESS, etc.)
  - Search by task title/description
- **Close Behavior:**
  - X button, click outside, or Escape key → close modal

**Visual Design:**
- Modal: centered overlay with backdrop blur
- Max height with scroll for long task lists
- Task cards: hover effect, clickable
- Status badges: same colors as Sprint view
- Loading states when assigning/unassigning

### 2. Task Assignment Logic

**API Integration:**
- Use existing `PATCH /api/tasks/[id]` endpoint
- Update `assignedAgentId` field
- Optimistic updates in UI (show immediately, rollback on error)

**Store Updates:**
- When task assigned → update task in memory (if we add task store)
- Agent Info Panel should show newly assigned task immediately
- Sprint view should reflect changes when navigated to

**Validation:**
- Agent can only be assigned one task at a time (enforce in UI)
- Show warning if assigning a second task: "Agent already has a task. Reassign?"
- Only TODO and IN_PROGRESS tasks can be assigned

### 3. Agent Workload Display

**In Agent Info Panel (Current State):**
- If agent has assigned task:
  - Show task title in info panel (below Location)
  - Link to task (click → navigate to Sprint tab + highlight task)
  - Status badge
- If no task:
  - Show "No task assigned" in muted text

**In Modal (Current Assignment Section):**
- If assigned task exists:
  - Full task card with title, status, description
  - "Unassign" button → confirm → remove assignment
  - Show when task was assigned (optional)

### 4. Task Reassignment Flow

**Scenario:** Agent A has Task 1, founder wants to assign Task 1 to Agent B

**Current Flow (via modal):**
1. Click Agent B → "Assign Task"
2. Modal shows Task 1 in available tasks (already assigned to A)
3. Task card shows "Currently assigned to [Agent A Role]"
4. Click Task 1 → warning modal: "Reassign from [Agent A] to [Agent B]?"
5. Confirm → Task 1 moves from A to B
6. Both agent panels update

**Alternatively (Unassign then Reassign):**
1. Click Agent A → "Assign Task"
2. Click "Unassign" on current task
3. Click Agent B → "Assign Task"
4. Select task from available list

### 5. Error Handling

**Common Errors:**
- Task no longer exists (deleted) → show error toast, refresh list
- Agent no longer exists → close modal, show error
- Assignment fails (API error) → rollback optimistic update, show error toast
- Network timeout → show retry option

**User Feedback:**
- Success toast: "Task assigned to [Agent Role]"
- Error toast: "Failed to assign task: [error message]"
- Loading spinner during API calls

---

## Component Structure

### New Modal Component

**File:** `src/components/task-assignment-modal.tsx`

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  description: string;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "FAILED";
  assignedAgent: { id: string; role: string } | null;
};

type TaskAssignmentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  agent: {
    id: string;
    role: string;
  };
  currentTask?: Task | null;
};

export function TaskAssignmentModal({
  isOpen,
  onClose,
  agent,
  currentTask,
}: TaskAssignmentModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available tasks
  useEffect(() => {
    if (!isOpen) return;
    fetchTasks();
  }, [isOpen]);

  const fetchTasks = async () => {
    // GET /api/tasks → filter assignable tasks
  };

  const handleAssign = async (taskId: string) => {
    // PATCH /api/tasks/[taskId] with assignedAgentId
    // Optimistic update
    // Show success toast
    // Close modal
  };

  const handleUnassign = async () => {
    // PATCH /api/tasks/[currentTask.id] with assignedAgentId: null
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="max-h-[80vh] w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        {/* Modal content */}
      </div>
    </div>
  );
}
```

### Updated OfficeCanvasPixi

**Modify:** `src/components/office-canvas-pixi.tsx`

```tsx
import { TaskAssignmentModal } from "@/components/task-assignment-modal";

export function OfficeCanvasPixi() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<SelectedAgent | null>(null);

  // ... existing code

  return (
    <div className="flex gap-4">
      {/* ... existing panels and canvas */}

      {/* Agent Info Panel */}
      {selectedAgent && (
        <aside className="...">
          {/* ... existing info */}
          <button
            onClick={() => setModalOpen(true)}
            className="mt-4 w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Assign Task
          </button>
        </aside>
      )}

      {/* Task Assignment Modal */}
      {selectedAgent && (
        <TaskAssignmentModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          agent={{ id: selectedAgent.id, role: selectedAgent.role }}
          currentTask={selectedAgent.assignedTask}
        />
      )}
    </div>
  );
}
```

---

## API Integration

### Fetch Available Tasks

```typescript
// GET /api/tasks
const response = await fetch("/api/tasks");
const { tasks } = await response.json();

// Filter assignable tasks (TODO or IN_PROGRESS)
const assignable = tasks.filter(
  (t) => t.status === "TODO" || t.status === "IN_PROGRESS"
);
```

### Assign Task to Agent

```typescript
// PATCH /api/tasks/[taskId]
const response = await fetch(`/api/tasks/${taskId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    assignedAgentId: agentId,
  }),
});

if (!response.ok) {
  throw new Error("Assignment failed");
}

const { task } = await response.json();
```

### Unassign Task

```typescript
// PATCH /api/tasks/[taskId]
await fetch(`/api/tasks/${taskId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    assignedAgentId: null,
  }),
});
```

---

## Agent Info Panel Updates

**Current Display (when task assigned):**

```tsx
{selectedAgent.assignedTask && (
  <div>
    <dt className="text-xs text-zinc-500">Assigned Task</dt>
    <dd className="text-zinc-200">
      <button
        onClick={() => navigateToTask(selectedAgent.assignedTask.id)}
        className="text-blue-400 hover:text-blue-300 hover:underline"
      >
        {selectedAgent.assignedTask.title}
      </button>
    </dd>
    <dd className="mt-1 text-xs text-zinc-500">
      {selectedAgent.assignedTask.status}
    </dd>
  </div>
)}
```

**Note:** Clicking task title navigates to Sprint tab and highlights the task (optional enhancement).

---

## Acceptance Criteria

- [ ] Clicking "Assign Task" button opens modal
- [ ] Modal displays agent role in header
- [ ] Modal shows currently assigned task (if any) with "Unassign" button
- [ ] Modal lists available tasks (TODO + IN_PROGRESS) from current sprint
- [ ] Tasks display title, status badge, description excerpt
- [ ] Clicking a task assigns it to the agent and closes modal
- [ ] Optimistic UI update (task appears immediately in agent panel)
- [ ] API call updates database (assignedAgentId field)
- [ ] Success toast confirms assignment
- [ ] Error handling with rollback if API fails
- [ ] "Unassign" button removes task assignment
- [ ] Search/filter controls work (filter by status, search by title)
- [ ] Modal closes via X button, click outside, or Escape key
- [ ] Reassignment warning when assigning task that's already assigned to another agent
- [ ] Agent Info Panel shows assigned task title as clickable link (optional: navigate to Sprint)
- [ ] No regressions in existing Office or Sprint functionality

---

## Testing Scenarios

1. **Fresh Assignment:** Agent with no task → assign task → verify in panel and database
2. **Unassign:** Agent with task → click "Unassign" → verify task cleared
3. **Reassignment:** Task assigned to Agent A → assign to Agent B → both panels update
4. **Filter/Search:** Filter by status → only matching tasks show; search by title → results narrow
5. **Error Handling:** Kill API during assignment → optimistic update rolls back, error toast shows
6. **Edge Cases:** Assign same task twice, delete task while modal open, agent deleted during assignment
7. **Navigation:** Click task title in Agent Info Panel → should navigate to Sprint tab (if implemented)

---

## Optional Enhancements (Future Tickets)

- **Bulk Assignment:** Assign multiple tasks to multiple agents at once
- **Smart Suggestions:** AI-powered task-to-agent recommendations based on role/workload
- **Task Details Modal:** Click task card → see full task details before assigning
- **Agent Capacity:** Show agent workload score (1 task = OK, 2+ tasks = overloaded)
- **Drag-and-Drop:** Drag task from Sprint view onto agent in Office canvas
- **Task Timeline:** Show when task was assigned, estimated completion time
- **Notifications:** Notify agents (if multi-user) when tasks are assigned to them

---

## Files to Create/Modify

**Create:**
- `src/components/task-assignment-modal.tsx` (new modal component)

**Modify:**
- `src/components/office-canvas-pixi.tsx` (add modal trigger, pass agent/task data)
- Optional: `src/components/sprint-view.tsx` (highlight task when navigated from Office)

---

## Notes for Claude Code

- Use existing API endpoints (no new backend changes needed)
- Match existing UI patterns (Tailwind classes, toast library)
- Keep modal accessible (focus trap, Escape key, click outside to close)
- Optimize for performance (don't reload all tasks on every modal open)
- Consider using existing components for task cards if available
- Test reassignment flow carefully (edge case: assign task that's already assigned)

---

## Success Metrics

- Founders can assign tasks to agents directly from Office view
- Agent Info Panel accurately reflects current task assignments
- Task assignment workflow feels smooth and intuitive
- Office → Sprint integration complete (can see agent workload in both views)
- Foundation ready for more advanced assignment features (bulk, AI suggestions, etc.)

---

**End of Ticket**
