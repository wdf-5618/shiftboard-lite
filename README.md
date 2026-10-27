# ShiftBoard Lite

ShiftBoard Lite is a responsive weekly staff scheduler for a fictional small service team. It is a practical learning project for React, Tailwind CSS, authentication, database design, and row-level access control.

## Stack

- React 19 and Vite
- Tailwind CSS 4
- Supabase Auth for email/password sign-in
- Supabase PostgreSQL for workspace, staff, and shift records
- PostgreSQL row-level security (RLS) for user-owned workspace data
- Browser `localStorage` fallback when Supabase environment variables are not configured

## Features

- Weekly schedule navigation
- Create, edit, and delete shifts
- Assign team members or leave shifts open
- Database-side validation that blocks overlapping assignments
- Team roster with search and member creation
- Overview metrics and coverage queue
- Email/password account creation, sign-in, and sign-out
- A private workspace for each authenticated account
- Responsive desktop and mobile layouts

## Run locally

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

Create and preview a production build with:

```bash
npm run build
npm run preview
```

## Connect Supabase

Set these environment variables in your local `.env.local` file and the Vercel project:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Use the **publishable** key in the browser. Never put the database password, a Supabase secret key, or a service-role key into frontend environment variables or the repository. Browser access depends on Supabase Auth and the RLS policies.

The schema is documented in `supabase/schema.sql` and is applied to the dedicated `shiftboard-lite-db` project. It contains:

- `workspaces`, owned by a Supabase Auth user
- `staff_members`, scoped to a workspace
- `shifts`, scoped to a workspace and optionally assigned to a staff member
- RLS policies restricting all records to the workspace owner
- A database trigger that validates staff/workspace consistency and prevents overlapping shift assignments

For email confirmation, configure the app URL and redirect URLs in Supabase Auth to include the production app URL and the preview URLs you actively use. New workspaces are seeded with fictional sample staff and shifts when first opened.

When the environment variables are absent, the front end stays in local demo mode using `localStorage`. In this mode records are browser-specific and are not shared.

## Important limitations

This remains a learning prototype. It is not a full workforce-management product; it has no payroll, notifications, external calendar integration, role-based team invitations, or multi-workspace switching. Use fictional data only.
