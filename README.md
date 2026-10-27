# ShiftBoard Lite

A responsive weekly staff-scheduling dashboard for a fictional small service team. This project practices React state, component structure, form validation, scheduling rules, and Tailwind CSS.

## Stack

- React 19
- Vite
- Tailwind CSS 4 using the official Vite plugin
- Browser localStorage for local demo persistence

## Run locally

Requires Node.js 22.12 or newer.

~~~bash
npm install
npm run dev
~~~

Create and preview a production build with:

~~~bash
npm run build
npm run preview
~~~

## Features

- Weekly schedule with previous/next week navigation
- Create, edit, and delete shifts
- Assign a team member or leave a shift open
- Prevent overlapping shifts for the same team member
- Team roster with search and basic member creation
- Overview metrics for planned shifts, open shifts, team size, and planned hours
- Coverage view for unassigned shifts
- Responsive layout for desktop and mobile
- Local demo data saved in the current browser

## Demo limitations

This is a front-end learning prototype. Data is stored only in localStorage in the browser being used. There is no authentication, server, shared database, real-time collaboration, payroll calculation, or calendar integration. Records on one device are not visible to another user. Use fictional data only.

## Manual test checklist

- [ ] Create a shift and confirm that it appears on the correct day.
- [ ] Edit a shift and verify its details update.
- [ ] Try to assign one person overlapping shifts on the same day and confirm it is blocked.
- [ ] Create an open shift and verify it appears in Coverage.
- [ ] Add a team member and assign them a shift.
- [ ] Change weeks, return to the current week, and confirm dates are correct.
- [ ] Refresh the page and confirm demo data persists in the same browser.
- [ ] Check the layout at a narrow mobile width.
