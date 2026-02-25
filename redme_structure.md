# Schedule Flow – Project Structure and Data Flow

A simple guide to where everything lives and how data moves through the app.


---

## PART 1: ROOT AND CONFIG FILES

**package.json**
- Scripts: dev (Vite), server (Express on port 3001), build, lint
- Holds all dependencies (React, Vite, Express, sqlite3, etc.)

**vite.config.ts**
- Vite build config and path alias (e.g. @/ points to src)

**tsconfig.json and tsconfig.app.json**
- TypeScript settings

**tailwind.config.ts**
- Tailwind CSS and theme (colors like primary, card)

**index.html**
- Single HTML page; React mounts into the root div

**data.db**
- SQLite database file used by the server (created automatically)

**server folder**
- Backend API (see Part 3)

**public folder**
- Static files: favicon, robots.txt


---

## PART 2: FRONTEND (src folder)


### 2.1 Entry point

**main.tsx**
- Renders the App component into the page and loads global CSS.


### 2.2 App and routing (App.tsx)

**Provider order (outer to inner):**
- QueryClientProvider
- ThemeProvider
- TooltipProvider
- AuthProvider
- TemplatesProvider
- TasksProvider
- BrowserRouter

**Protected routes (user must be logged in):**
- / → Dashboard (Index)
- /today → Today’s tasks
- /week → This week’s tasks
- /month → This month’s tasks
- /calendar → Calendar
- /task/:date → Tasks for one day (date in URL)
- /profile → User profile
- /reset-password → Change password

**Public routes (no login required):**
- /login
- /signup
- /forgot-password
- /onboarding

**Catch-all:**
- Any other path → NotFound (404)

**How pages get data:** From hooks (useTasks, useAuth, etc.) and from URL (e.g. :date). No data is passed through route props.


### 2.3 Types (src/types)

**task.ts**
- Defines Task: id, title, description, completed, priority, dueDate, createdAt, color, time slots, reminder, category
- Also TaskTemplate, TaskComment, TaskShare, UserStreak (used in types and some lib code)
- Frontend uses camelCase; server uses snake_case; hooks convert between them


### 2.4 Hooks (src/hooks) – where data lives

**useAuth.tsx**
- Keeps login token and user profile
- Reads/writes: localStorage and API (login, signup, profile, onboarding)
- Used by: Login, Signup, Onboarding, Profile, Sidebar, RequireAuth, and any page that needs user/token

**useTasks.tsx**
- Keeps list of tasks and functions to add, update, delete, toggle
- Talks to API: GET/POST/PATCH/DELETE /tasks with the auth token
- Used by: Index, FilteredTasksPage, DayTasksPage, Calendar, AddTaskForm, TaskList, SmartRescheduleButton

**useTemplates.tsx**
- Keeps templates and “create task from template”
- Talks to API: GET/POST/DELETE /templates and POST /templates/:id/create-task
- Used by: Index (TemplatesList and “save as template”)

**useTheme.tsx**
- Dark/light theme; used by Sidebar

**use-mobile.tsx and use-toast.ts**
- Small UI helpers; used where needed

**Important:** All pages share the same hook state (same context). Nothing is “sent” from one page to another except URL (e.g. date) and sometimes redirect path in location state.


### 2.5 Lib (src/lib) – pure logic, no API

**utils.ts**
- Helper functions (e.g. cn for CSS class names)

**aiPrioritizer.ts**
- Sorts tasks by simple “importance” (keywords, time slots)
- Used on DayTasksPage to order that day’s tasks

**scheduler.ts**
- Finds overdue tasks and free time slots
- Used by SmartRescheduleButton to suggest new dates/times

**nlpParser.ts**
- Turns text like “meeting tomorrow at 2pm” into title, date, time, priority
- Used by AITaskForm

**analytics.ts**
- Computes productivity stats (streak, completed vs total)
- Used by ProductivityStats


### 2.6 Components (src/components)

**Layout**
- Wraps the app: sidebar + main area where the current page renders (Outlet)
- Only manages layout (sidebar open/closed, mobile)

**Sidebar**
- Navigation links: Dashboard, Today, Week, Month, Calendar
- User avatar, theme toggle, logout
- Gets user and logout from useAuth, theme from useTheme

**RequireAuth**
- If no token → redirect to /login
- If onboarding not done → redirect to /onboarding
- Otherwise shows the protected content (Layout + children)

**AddTaskForm**
- Form: title, priority, due date, color, reminder, time slot, “Save as template”
- Parent passes onAdd (and optionally onSaveAsTemplate); form calls these when user submits

**AITaskForm**
- User types in natural language; nlpParser extracts title, date, time, priority
- Calls onAdd with that data (parent usually passes addTask from useTasks)

**TaskList**
- Shows list of tasks with checkboxes and actions
- Receives: tasks array, onToggle, onDelete, onUpdate, and optional bulk handlers
- Parent gets tasks from useTasks (often filtered) and passes these callbacks

**TaskItem**
- One task row (checkbox, title, edit, delete)
- Used inside TaskList

**TaskFilters**
- Search, priority, color, date range
- Used on Index page

**FilterTabs**
- Tabs: All / Active / Completed
- Used on Index page

**CalendarView**
- Month grid; shows task dots; clicking a day calls onSelectDate(date)
- Calendar page passes: onSelectDate = (date) => navigate to /task/yyyy-MM-dd
- So the “data” sent to the day page is just the date in the URL

**TemplatesList**
- Lists templates and “create task from template”
- Uses useTemplates()

**SmartRescheduleButton**
- Uses useTasks and scheduler to reschedule overdue tasks
- Calls API to update tasks

**ProductivityStats**
- Shows stats from tasks; uses analytics lib

**ColorPicker**
- Picks a color; used inside AddTaskForm

**ui folder**
- Reusable UI pieces (Button, Input, Dialog, Calendar, etc.) from shadcn
- No app data; only presentation

**Data flow:** Hooks → pages → components. Pages get data from hooks and pass it down as props and callbacks. No Redux. Between pages, only URL params (like date) or location state (like “redirect after login”) carry information.


### 2.7 Pages (src/pages)

**Index (route: /)**
- Uses useTasks and useTemplates
- Filters tasks (all/active/completed + search, priority, etc.)
- Passes filtered tasks and add/toggle/delete/update to TaskList and forms
- Has bulk select and ProductivityStats

**FilteredTasksPage (routes: /today, /week, /month)**
- Gets filter from route (today, week, or month) as a prop
- Uses useTasks; filters tasks by that date range
- Renders TaskList and AddTaskForm

**DayTasksPage (route: /task/:date)**
- Reads date from URL (e.g. 2025-02-07)
- Uses useTasks; filters tasks for that day; sorts with aiPrioritizer
- AddTaskForm gets default due date = that day

**Calendar (route: /calendar)**
- Uses useTasks; passes tasks and onToggle to CalendarView
- When user clicks a day, navigates to /task/yyyy-MM-dd (date in URL)

**Login (route: /login)**
- Form: email, password; calls login() from useAuth
- After success, redirects to “from” (saved by RequireAuth) or /

**Signup (route: /signup)**
- Form: email, password; calls signup() then redirects

**ForgotPassword (route: /forgot-password)**
- User enters email and new password; no login needed

**ResetPassword (route: /reset-password)**
- User must be logged in; changes password via useAuth

**Onboarding (route: /onboarding)**
- Form: role, age, 2–5 priority tasks
- Sends PATCH /user/onboarding with token; then fetches profile and redirects to /

**Profile (route: /profile)**
- Shows and edits profile; updateProfile() calls PATCH /user/profile

**NotFound**
- Shown for any unknown path (404)


---

## PART 3: SERVER (server folder)

**File:** server/index.js

**Tech:** Express, CORS, sqlite3, bcryptjs, jsonwebtoken

**Port:** 3001 (or PORT env)

**Database file:** data.db in project root (created if missing)


### Database tables (SQLite)

**users**
- id, email, password_hash, created_at
- role, age, priority_task (JSON), onboarding_completed

**tasks**
- id (UUID), user_id, title, description, priority, completed
- due_date, created_at, color, reminder_time
- time_slot_start, time_slot_end, category

**templates**
- id (UUID), user_id, title, description, priority, category
- time_slot_start, time_slot_end, color, created_at

Every task and template is tied to a user (user_id from the JWT).


### API endpoints

**Auth (no token needed):**
- POST /auth/signup – create account; returns token and user
- POST /auth/login – check email/password; returns token and user
- POST /auth/forgot-password – set new password by email

**Auth (token required):**
- POST /auth/reset-password – set new password when logged in

**Tasks (token required):**
- GET /tasks – list current user’s tasks
- POST /tasks – create task
- PATCH /tasks/:id – update task
- DELETE /tasks/:id – delete task

**User (token required):**
- GET /user/profile – get profile
- PATCH /user/profile – update profile
- PATCH /user/onboarding – save role, age, priority tasks, set onboarding done

**Templates (token required):**
- GET /templates – list templates
- POST /templates – create template
- DELETE /templates/:id – delete template
- POST /templates/:id/create-task – create one task from template (optional dueDate in body)

**Auth on server:** Request header “Authorization: Bearer &lt;token&gt;”. Middleware reads the token and sets req.userId.


---

## PART 4: HOW DATA MOVES (SUMMARY)

1. **App start**
   - main.tsx loads App; all providers mount.
   - Auth: token and user come from localStorage into AuthProvider.
   - RequireAuth checks token and onboarding; redirects to /login or /onboarding if needed.

2. **After login**
   - TasksProvider and TemplatesProvider fetch /tasks and /templates and keep that data in context.
   - Every protected page uses useTasks(), useTemplates(), useAuth() and passes data and callbacks to components.

3. **User actions**
   - Add/edit/delete task: component calls addTask/updateTask/deleteTask from useTasks → API (POST/PATCH/DELETE /tasks) → server updates data.db → hook updates state → UI updates.
   - Same idea for templates and profile/onboarding.

4. **Between pages**
   - Calendar → Day: user clicks date → navigate to /task/yyyy-MM-dd → DayTasksPage reads :date from URL and filters that day from the same useTasks() list.
   - Login redirect: RequireAuth stores the previous path; Login redirects back there after successful login.

**End-to-end chain:** data.db ↔ server (Express) ↔ REST API ↔ hooks (Auth/Tasks/Templates + localStorage for token) ↔ pages ↔ components. The only “page-to-page” data is in the URL (e.g. date) or in location state (e.g. redirect path).
