# AICS-Tool Frontend MVP

Frontend MVP for a research lab workflow platform built with React + TypeScript + Vite + Tailwind CSS.

## 1. Run the project

### Requirements
- Node.js 20+ (LTS recommended)
- npm 10+

### Install dependencies
```bash
npm install
```

### Start dev server
```bash
npm run dev
```

Open the local URL from Vite output (default: `http://localhost:5173`).

### Build for production
```bash
npm run build
```

### Preview production build
```bash
npm run preview
```

---

## 2. File structure

```text
AICS-Tool/
├─ public/
├─ src/
│  ├─ app/
│  │  ├─ layouts/
│  │  │  └─ app-layout.tsx
│  │  ├─ store/
│  │  │  └─ use-lab-store.ts
│  │  └─ App.tsx
│  ├─ entities/
│  │  └─ models.ts
│  ├─ features/
│  │  ├─ auth/
│  │  ├─ calendar/
│  │  ├─ documents/
│  │  ├─ projects/
│  │  └─ tasks/
│  ├─ mock/
│  │  └─ data.ts
│  ├─ pages/
│  │  ├─ login-page.tsx
│  │  ├─ dashboard-page.tsx
│  │  ├─ projects-page.tsx
│  │  ├─ project-detail-page.tsx
│  │  ├─ document-page.tsx
│  │  ├─ task-board-page.tsx
│  │  ├─ calendar-page.tsx
│  │  ├─ settings-page.tsx
│  │  └─ not-found-page.tsx
│  ├─ shared/
│  │  ├─ lib/
│  │  └─ ui/
│  ├─ index.css
│  └─ main.tsx
├─ index.html
├─ package.json
├─ tailwind.config.ts
├─ postcss.config.js
└─ vite.config.ts
```

---

## 3. NPM scripts

- `npm run dev`: start development server
- `npm run build`: run TypeScript build check and Vite production build
- `npm run preview`: preview built assets locally

---

## 4. Routes

- `/login`
- `/dashboard`
- `/projects`
- `/projects/:projectId`
- `/projects/:projectId/docs/:docId`
- `/projects/:projectId/tasks`
- `/calendar`
- `/settings`

