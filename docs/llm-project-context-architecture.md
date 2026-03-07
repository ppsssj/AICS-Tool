# LLM Project Context Architecture

This document defines the app-side architecture needed to support a future LLM assistant that can:

- understand project-oriented user intent
- resolve the correct project workspace
- move the UI into that workspace
- keep later actions scoped to the active project context

Example user intents:

- "I want to manage my graduation project."
- "Open the graduation project documents."
- "Add a task to this project."
- "Show only review-waiting work."

## Design principle

The LLM should not guess application state from UI text.

Instead, the app should expose:

- current route
- active project context
- recent project context
- project/task/document summaries
- explicit navigation and CRUD tools

The LLM decides intent.
The application owns state, routing, and data authority.

## Recommended app state

Add a workspace context model at app level.

```ts
interface WorkspaceContext {
  activeProjectId: string | null;
  activeDocumentId: string | null;
  currentRoute: string;
  lastResolvedEntity?:
    | { kind: 'project'; id: string }
    | { kind: 'document'; id: string }
    | { kind: 'task'; id: string };
  recentProjectIds: string[];
}
```

Recommended derived summary:

```ts
interface ProjectSummary {
  id: string;
  title: string;
  description: string;
  status: 'Planning' | 'Active' | 'Done' | 'Archived';
  memberCount: number;
  overdueTaskCount: number;
  reviewTaskCount: number;
  dueThisWeekCount: number;
}
```

## Responsibility split

### LLM responsibilities

- classify user intent
- decide whether the request is global, project-scoped, or ambiguous
- choose the next tool or clarification step
- ask a short clarification question when project resolution is uncertain

### App responsibilities

- store authoritative state
- resolve navigation
- enforce project scoping for operations
- return structured tool results
- persist active project context between turns

## Recommended tool surface

Keep the tool surface small and explicit.

### Discovery tools

```ts
findProjects(query: string): Promise<Array<{
  id: string;
  title: string;
  score: number;
  status: string;
}>>;

getWorkspaceContext(): Promise<WorkspaceContext>;

getProjectSummary(projectId: string): Promise<ProjectSummary>;
```

### Navigation tools

```ts
navigateToRoute(route: string): Promise<{ route: string }>;

activateProjectContext(projectId: string): Promise<{
  activeProjectId: string;
  route: string;
}>;
```

`activateProjectContext(projectId)` should normally:

1. set `activeProjectId`
2. navigate to `/projects/:projectId`
3. return final route and active context

### Project-scoped tools

```ts
listProjectTasks(projectId: string, filter?: {
  status?: string[];
  dueWindow?: 'today' | 'week';
  linkedDocOnly?: boolean;
}): Promise<unknown>;

listProjectDocuments(projectId: string): Promise<unknown>;

listProjectSchedules(projectId: string): Promise<unknown>;

createProjectTask(projectId: string, input: {
  title: string;
  description: string;
  priority: string;
  assigneeId?: string;
  dueDate?: string;
  documentId?: string;
}): Promise<unknown>;
```

## Resolution rules

### Rule 1

If the user is already inside `/projects/:projectId`, default to that project unless another project is explicitly named.

### Rule 2

If the user explicitly names a project, explicit name beats current context.

### Rule 3

If the user says "this project", "here", or makes a follow-up request without naming another project, resolve from `activeProjectId`.

### Rule 4

If the request is destructive and project resolution is uncertain, ask a clarification question before acting.

## Resolution flow

### Case A: one clear match

User:

`I want to manage the graduation project.`

Flow:

1. `findProjects("graduation project")`
2. exactly one strong match
3. `activateProjectContext(projectId)`
4. optional `getProjectSummary(projectId)`

Assistant:

`Moved into the graduation project workspace. There are 4 tasks due this week and 2 review-waiting tasks. Do you want tasks, docs, or schedule first?`

### Case B: multiple plausible matches

User:

`Open the graduation project.`

Possible matches:

- `Graduation Project Prototype`
- `Graduation Project Presentation`

Assistant:

`There are two matching projects: Graduation Project Prototype and Graduation Project Presentation. Which one should I open?`

### Case C: no match

Assistant:

`I could not find a matching project. Do you want to create a new one or search with another name?`

## Orchestration pipeline

Recommended request pipeline:

1. get current workspace context
2. classify intent
3. if project intent exists:
   - resolve project
   - activate project context if needed
4. perform the scoped tool call
5. return a short action-oriented response

## Routing and AI context must move together

Avoid these failure modes:

- route changes but active AI project context does not update
- active AI project context changes but route does not update
- weak match silently switches the user to the wrong project
- the assistant stays global after the UI has already entered a project

The route and AI project context should remain synchronized.

## Minimal first implementation

If you want the smallest useful future version, implement only:

- `getWorkspaceContext`
- `findProjects`
- `activateProjectContext`
- `listProjectTasks`
- `listProjectDocuments`

That is enough to support:

- entering the correct project workspace
- keeping follow-up requests project-scoped
- opening project docs and tasks reliably

## UI integration recommendation

If you later add an AI side panel, it should trigger app actions, not only return text.

Recommended app actions:

- `setActiveProject(projectId)`
- `navigate(route)`
- `applyTaskBoardFilter(filter)`
- `openDocument(documentId)`

This allows the assistant to produce both:

1. a visible UI transition
2. a short explanation of what changed
