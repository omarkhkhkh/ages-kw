---
name: Task management ownership rules
description: Auth and middleware rules for the tasks feature — critical for future changes to /api/tasks
---

## Rules

1. **tasks router is mounted BEFORE the global `requireEdit` middleware** in `routes/index.ts`. This is intentional — employees without `canEdit` must still be able to add notes and update status on their assigned tasks. The tasks router enforces its own ownership checks.

2. **Employee PATCH restrictions**: non-admin can only update `employeeNotes` and `status` (pending↔in_progress) on tasks where `assignedTo === session.userId`. Any attempt on another user's task returns 403.

3. **Admin PATCH**: admin can update all fields including title, taskType, priority, status, assignedTo, dueDate.

4. **GET /tasks filtering**: admin sees all tasks; employee sees only tasks where `assigned_to = session.userId`.

5. **Unread notes tracking**: when an employee saves notes, `notes_read_by_admin` is reset to false. The admin marks it true via `PATCH /tasks/:id/mark-notes-read`, triggered automatically when they open the NotesModal.

**Why:** The task notes feature needs to be accessible to all employees regardless of their `canEdit` permission — it's a collaboration tool, not a content edit. Mounting before requireEdit is the cleanest solution.

**How to apply:** Any new routes that employees should access without `canEdit` must be mounted before the global mutation guard block in `routes/index.ts`.
