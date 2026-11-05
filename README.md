# TaskFlow

A soccer-inspired Kanban task board built with React, Vite, Tailwind CSS, Supabase, and dnd-kit. The interface uses a navy-and-emerald design and organizes work across **To Do**, **In Progress**, **In Review**, and **Done**.

**Live app:** https://taskflow-infinity.vercel.app/  
**Source:** https://github.com/ArnavKV/taskflow

## Features

- Drag full task cards between four columns; persist status changes to Supabase.
- Create, edit, and delete tasks with descriptions, priorities, due dates, labels, and assignees.
- Create a guest-managed teammate roster and assign multiple members to tasks.
- Add task comments and review task activity history.
- Search task titles/descriptions and filter by priority, label, or teammate.
- See task counts and due date / overdue indicators.
- Use the app without registering, through Supabase anonymous sign-in.
- Row Level Security restricts each guest to their own task data.

## Tech stack

- **Frontend:** React 19, JavaScript, Vite 8, Tailwind CSS 4, Lucide icons
- **Drag and drop:** dnd-kit
- **Backend and authentication:** Supabase Postgres, Supabase Auth, Row Level Security
- **Hosting:** Vercel

## Run locally

1. Install a recent Node.js LTS release.
2. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/ArnavKV/taskflow.git
   cd taskflow
   npm install
   ```

   If the repository is private, GitHub authentication and access are required to clone it.

3. Create `.env.local` in the repository root:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
   ```

4. In your Supabase project, enable **Authentication > Anonymous Sign-Ins**.
5. Create the `tasks`, `team_members`, `task_comments`, and `task_activity` tables, including their RLS policies, using the assessment schema provided with the submission. If applying to an existing project, use an incremental migration instead of re-creating policies.
6. Start the dev server:

   ```bash
   npm run dev
   ```

7. Open the local URL shown by Vite (usually `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

Deploy the Vite project on Vercel with build command `npm run build`, output folder `dist`, and the two `VITE_SUPABASE_*` environment variables above.

## Security and privacy

- The browser uses only the Supabase **public publishable key**; never place a service-role or secret key in frontend code.
- `.env.local` is excluded by `.gitignore`.
- Every task, teammate, comment, and activity record is tied to the guest account via `user_id` and protected by RLS.
- Anonymous sessions are browser-specific. A different browser or private session normally starts with a separate workspace.
- Team members are roster records within one guest workspace, not separately authenticated collaborators.

## Manual acceptance checks

- Create a task, edit its details, drag it to another column, and refresh.
- Create a teammate, assign them, and verify persistence after refresh.
- Post a comment and check the activity log.
- Confirm filters work and overdue indicators appear as expected.
- Open a fresh private browser session and confirm tasks from the first session are not visible.
- Check browser console for errors and test narrower screen widths.

## Tradeoffs / future improvements

- Add optional email or OAuth accounts for cross-device sync and account recovery.
- Normalize multi-assignee relationships and custom labels into join tables.
- Add keyboard-accessible drag alternatives, automated integration tests, and real-time collaboration.
- Support task ordering within columns and more advanced board permissions.

## Assessment note

This project was created for the Next Play Games software development assessment. The assessment document and final submission link should not be publicly reposted. Follow the designated submission instructions for sharing the final assessment document.
