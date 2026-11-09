# Portfolio changes

Artifax started as a team project. This repository continues from the team's final commit,
[`e64466e`](https://github.com/MarioOjo/Artifax/commit/e64466e), and this document records every change
made since then, so it is clear what differs from the original.

Each entry says what was wrong, why it mattered, what changed, and the commit that changed it.

| Area | Changes |
| --- | --- |
| [1. Running on new infrastructure](#1-running-on-new-infrastructure) | 7 |
| [2. Bug fixes from a code review](#2-bug-fixes-from-a-code-review) | 21 |
| [3. Enhancement: secure, transactional crafting](#3-enhancement-secure-transactional-crafting) | 6 |
| [4. Known issues](#4-known-issues) | — |

---

## 1. Running on new infrastructure

The original deployment (database, API host and installer) belonged to the team. The app was moved to new
infrastructure: PostgreSQL on Aiven, the API on Render (Docker, Frankfurt) and a freshly built Windows installer.
Getting it running surfaced these problems.

### 1.1 Migrations could not build a new database
- **Problem:** The team deleted their early migrations in `6b2c486`. The two that remained only added columns to
  tables (`Items`, `Employees`) the deleted ones had created, so `dotnet ef database update` failed on an empty
  database with `relation "Items" does not exist`.
- **Fix:** Replaced them with a single `InitialCreate` migration generated from the current model.
- **Commit:** `6cbc983`

### 1.2 A placeholder connection string crashed the deployed API
- **Problem:** `appsettings.json` contained a placeholder sentence as the connection string. It took precedence
  over the `DATABASE_*` environment variables, so the deployed API tried to connect with it and crashed on startup.
- **Fix:** Removed the placeholder. Local runs use user-secrets and deployments use environment variables.
- **Commit:** `6cbc983`

### 1.3 The installed desktop app could not reach the API
- **Problem:** The packaged Electron app loaded its pages from `file://`, so every API request had the origin
  `null`. The API's CORS policy only allowed `localhost`, so the installed app could not log in.
- **Fix:** The app now serves its build from a custom `app://artifax` scheme, which is limited to files inside the
  build folder. The API allows that origin. Allowing `null` was rejected because it would trust any local or
  sandboxed page.
- **Commit:** `80caf89`

### 1.4 Demo data
- **Problem:** A new database is empty, and the app has no sign-up, so there was nothing to log in with or look at.
- **Fix:** Added `Backend/Data/seed-demo.sql`, a single all-or-nothing script that loads three branches, 19 items,
  their recipes, branch stock, six fictional employees and 18 orders with history. It refuses to run if items or
  orders already exist.
- **Commit:** `963af2f`

### 1.5 The installer bundled the whole build toolchain
- **Problem:** `package.json` lists build-time tools (react-scripts, TypeScript, Tailwind, the testing libraries)
  as dependencies, and Electron Forge packs every dependency into the app. The app archive (`app.asar`) was 266 MB
  when it only needs the React production build and `main.js`. Separately, the Windows installer runs the app with
  install and uninstall flags so it can manage shortcuts, but `main.js` never checked for them, so the app opened
  during install and uninstall instead of exiting.
- **Fix:** The packager now includes an explicit allowlist: `package.json`, `main.js`, `build/` and the one runtime
  package. `main.js` handles the installer's flags with `electron-squirrel-startup` and takes its window icon from
  `build/`, which is the folder that ships.
- **Result:** `app.asar` went from 266 MB to 4.5 MB, and the installer from 200 MB to 145 MB. The rest is the
  Electron runtime, which every Electron app ships. The packaged app was launched to confirm it starts.
- **Commit:** `f6faa56`

### 1.6 First release from this repository
- **Problem:** The README sent people to the team's releases page, and described a zip download that the current
  build does not produce.
- **Fix:** Published [v0.1.0](https://github.com/MarioOjo/Artifax/releases/tag/v0.1.0) with the trimmed installer and
  its SHA-256 checksum. The README install steps now link to this repository's latest release and cover the
  SmartScreen prompt, sign-in with 2FA and the free-tier cold start.
- **Commits:** release built from `1fbaeb4`; README `453ac4e`

### 1.7 Release v0.2.0: the enhancement
- **What:** [v0.2.0](https://github.com/MarioOjo/Artifax/releases/tag/v0.2.0) ships the enhancement in section 3 to
  the desktop app: server-side crafting stock with shortage messages, and confirmations that say what removing a
  user or blueprint keeps.
- **Deployment order:** The two new database migrations were applied to the hosted database first, while the
  previous API version kept working on the new schema. The code was merged after that. `/health` then reported
  the merge commit (`1490e8c`) with the database reachable, and anonymous API requests returned 401.
- **Why the version bump:** The Windows installer (Squirrel) only updates an existing install to a higher version.

### 1.8 Portable download, as the team shipped it
- **Problem:** The team distributed a portable `Artifax-win32-x64.zip`: unzip and run `Artifax.exe`, with nothing to
  install. The Forge config only builds the zip for macOS, so this repository's releases offered only the Setup.exe
  installer.
- **Fix:** The zip maker now also targets Windows, so `npm run make` produces both. The v0.3.0 zip was made from the
  same packaged build as the v0.3.0 installer (same React bundle, version 0.3.0), and the README install steps now
  lead with the portable download, using a link to the latest release that does not change between versions.
- **Result:** A fresh extraction of the zip into an empty folder launched the app.

### 1.9 Release v0.3.1: polish
- **What:** v0.3.1 ships the interface fixes in 2.22 to 2.25 to the desktop app: the session spinner, themed
  notifications and confirmation dialogs, and the dashboard and user form fixes. The fix in 2.26 is server-side and
  was already live for every version of the app.
- **Downloads:** The first release built with the Windows zip maker, so `npm run make` produced the portable zip and
  the installer from one build.

### 1.10 Release v0.3.2: inventory table
- **What:** v0.3.2 ships the inventory fixes in 2.27 to the desktop app: separate quantity and production-time
  columns, category tabs that stay applied while searching, and clearer low-stock and raw-material labels.

### 1.11 Release v0.3.3: sign-in works again, clearer errors
- **What:** v0.3.3 ships the fixes in 2.28 to 2.30. Earlier releases had the old Render address built in and could
  not sign in; this one connects to `https://artifax-x8pr.onrender.com`. Failed loads now say so and offer Retry
  instead of looking like empty data. Order controls explain failures, and are disabled for the read-only demo. A
  slow first sign-in is explained. Placeholder text is gone, and several dead or unreachable controls are fixed.

---

## 2. Bug fixes from a code review

A review of the whole app, run against the demo data, found the problems below. They are listed from most to
least serious.

| # | Problem | Status |
| --- | --- | --- |
| 2.1 | Editing an inventory row could overwrite another branch's stock | fixed |
| 2.2 | Expedited orders showed "Complete" when only half done | fixed |
| 2.3 | The queue activated the same order more than once | fixed |
| 2.4 | The dashboard's crafting queue showed wrong names, quantities and order | fixed |
| 2.5 | Order history recorded manual changes as "System"; resuming reset the start time | fixed |
| 2.6 | Inventory "View" opened every branch's row; low-stock alert ignored the user's branch | fixed |
| 2.7 | New blueprints could create ingredients that never appear in inventory | fixed |
| 2.8 | Production time was labelled in seconds but is minutes | fixed |
| 2.9 | Hard-coded rule that branch 3 is "virtual" (left over from the team's database) | fixed |
| 2.10 | Branch name lost after login | fixed |
| 2.11 | 2FA failures always showed the same message, hiding the real cause | fixed |
| 2.12 | Debug logging left in production code | fixed |
| 2.13 | Out-of-date tests (frontend 27 of 39 failing, backend 4 of 80) | fixed |
| 2.14 | "Total Jobs" stat counted only queued orders | fixed |
| 2.15 | Queue counter counted paused orders against the 3-active limit | fixed |
| 2.16 | Crafting history showed "Unknown" for every employee | fixed |
| 2.17 | Cancelling a user edit could set their password to "************" | fixed |
| 2.18 | Anyone with a password could enrol their own 2FA authenticator | fixed |
| 2.19 | Every signed-in user could list everyone's email address | fixed |
| 2.20 | Vulnerable dependencies | fixed |
| 2.21 | 15 frontend build warnings and an outdated README test section | fixed |

Items 2.14 to 2.17 were found while bringing the tests up to date. Items 2.18 and 2.19 were found while designing the
demo account (3.6).

### 2.1 Editing an inventory row could overwrite another branch's stock
- **Problem:** Each item appears once per branch, but the inventory page tracked the row being edited by item ID
  alone. Editing Steel Sheet at Johannesburg opened the first branch's Steel Sheet row, so saving wrote that
  quantity to the wrong branch.
- **Fix:** Rows are identified by item and branch together.
- **Commit:** `42c264e`

### 2.2 Expedited orders showed "Complete" when only half done
- **Problem:** The backend already advances expedited orders at double speed. The UI halved the total time again,
  so an expedited order showed 100% and "Complete" at the halfway point.
- **Fix:** Progress is elapsed / total. Expediting only halves the real time left.
- **Commit:** `c3d49ba`

### 2.3 The queue activated the same order more than once
- **Problem:** When slots freed up, the background service looked up "the oldest queued order" once per slot, but
  only saved after the loop, so the database kept returning the same order. It was activated once per free slot
  (duplicate history entries) while other queued orders waited a further minute. Seen in live data: orders 28 and
  36 each had two activation entries.
- **Fix:** Fetch the oldest *N* queued orders in one query.
- **Evidence:** New tests in `OrderTimeTrackingServiceTests`. On the old code one order got 3 activation entries and
  only one of two free slots was filled; on the new code both tests pass.
- **Commit:** `7d07b89`

### 2.4 The dashboard's crafting queue showed wrong data
- **Problem:** The dashboard read `orderItems` and `orderDateTime`, which the API does not return. Jobs showed as
  "Order 21", quantity 1, in arbitrary order, with the order number as their location.
- **Fix:** Use the fields the API returns and show the branch name. Two unused helpers that would have crashed on
  real data were removed.
- **Commit:** `e1e8724`

### 2.5 Order history did not say who made a change
- **Problem:** Manual pause, resume and cancel were recorded as "System", because the app never sent an employee ID.
  Resuming a paused order also overwrote its original start time.
- **Fix:** The API records the logged-in employee from the session, rather than trusting a value in the request.
  The start time is only set the first time an order becomes active.
- **Commit:** `4b46a07`

### 2.6 Inventory "View" and low-stock alerts
- **Problem:** "View" expanded every branch's row for an item at once. The low-stock alert was meant to show the
  user's branch only, but read the branch from `/User/me`, which never returns one, so it showed every branch.
- **Fix:** Rows are identified by item and branch (as in 2.1). The alert uses the branch stored at login.
- **Commit:** `42c264e`

### 2.7 New blueprints could create items that never appear in inventory
- **Problem:**
  - Ingredients typed as new names, and the product itself, were created without stock rows (the product got one at
    the first branch only). They never appeared in Inventory, so they could not be stocked and the blueprint could
    never be crafted.
  - Using the name of an item that already had a recipe overwrote it and appended duplicate recipe lines.
  - Names were matched case-sensitively, so "steel sheet" created a second Steel Sheet.
- **Fix:** New items get a zero-stock row at every branch. Reusing the name of an existing blueprint is refused.
  Recipes are saved with replace semantics, names are matched case-insensitively, and the API merges a material
  listed twice into one line.
- **Evidence:** New test `EditItemBlueprint_WithRepeatedIngredient_StoresOneMergedLine` fails on the old code and
  passes on the new.
- **Commit:** `382aa37`

### 2.8 Production time labelled in seconds
- **Problem:** Production time is stored and used in minutes, but four labels showed it as seconds.
- **Fix:** Labels say "min".
- **Commits:** `ff9ee14`, `7579666` (the crafting page label)

### 2.9 Hard-coded "branch 3 is virtual" rule
- **Problem:** Crafting refused to run for branch ID 3, and the crafting views showed every branch's orders to it.
  This described a branch in the team's old database. In any other database it silently changes behaviour for
  whichever branch happens to get ID 3.
- **Fix:** Removed.
- **Commit:** `7579666`

### 2.10 Branch name lost after login
- **Problem:** The login code typed branches with `BranchID`/`BranchName`, but the API returns `branchID`/`branchName`,
  so the user's branch name was never found.
- **Fix:** Corrected the type and the code that uses it.
- **Commit:** `1e1dc39`

### 2.11 2FA failures always showed the same message
- **Problem:** The verification screen said "The code entered did not match" for every failure, including an
  expired session, which needs a different fix.
- **Fix:** The screen now shows the server's actual reason.
- **Commit:** `7a1cece`

### 2.12 Debug logging left in production code
- **Problem:** The API printed the start of the database connection string at startup. The app logged session
  responses and the full inventory list on every filter change.
- **Fix:** Removed. Remaining error logs use `console.error` with a message.
- **Commits:** `42c264e` (inventory), `1ddf197`

### 2.13 Out-of-date tests
- **Problem:** When the project was handed over, 27 of 39 frontend tests and 4 of 80 backend tests failed.
  - Frontend mocks were missing a newer hook, and the test environment lacks `scrollIntoView`.
  - Several suites mocked `axios` or `fetch`, but the components use a shared API client, so the mocks never
    applied. The inventory service tests were calling the deployed API.
  - Many assertions checked placeholder values from before the screens were connected to the API.
  - Backend user tests still expected a one-step login, from before 2FA.
- **Fix:** Tests now mock the shared API client and assert real behaviour. Backend login tests go through both
  steps, generating a valid code from the stored secret as an authenticator app would.
- **Result:** Backend 85 of 85 passing, frontend 45 of 45 passing, and TypeScript reports no errors. New regression
  tests cover 2.1, 2.3, 2.7, 2.17 and the 2FA step; each fails on the old code and passes on the new.
- **Commits:** `7d07b89`, `382aa37`, `2b31519`, `7e95d30`, `952c215`

### 2.14 "Total Jobs" counted only queued orders
- **Problem:** The crafting history card labelled "Total Jobs" showed the number of queued orders.
- **Fix:** It counts all orders.
- **Commit:** `7a11f72`

### 2.15 Queue counter counted paused orders
- **Problem:** The queue's "x / 3" counter included paused orders, but the limit applies to active orders only, so
  three active orders plus one paused showed "4 / 3".
- **Fix:** The counter counts active orders. Paused orders are still listed.
- **Commit:** `7a3257b`

### 2.16 Crafting history showed "Unknown" for every employee
- **Problem:** The history table read an employee name the API does not return, so every row said "Unknown" and
  searching by employee never matched.
- **Fix:** Names are looked up from the user list.
- **Commit:** `bb41cf7`

### 2.17 Cancelling a user edit could set their password to "************"
- **Problem:** On the user form, typing a new password and pressing Cancel put the literal text "************" in the
  field but left it marked as changed. Editing again and saving sent that text as the user's new password.
- **Fix:** Cancel clears the field and its changed flag.
- **Evidence:** New regression test; on the old code the saved password was "************".
- **Commit:** `7e95d30`

### 2.18 Anyone with a password could enrol their own 2FA authenticator
- **Problem:** The 2FA setup QR code, and with it the secret, was shown after the password step on every sign-in,
  not only the first. Anyone who learned a password could scan it into their own phone and pass 2FA, so 2FA added
  no protection.
- **Fix:** The first successful code marks the account's 2FA as confirmed, and setup is refused from then on. To
  avoid locking out someone who loses their phone, admins get a **Reset 2FA** action: it clears the secret, and the
  next sign-in shows a new QR code. The verification screen explains when setup is unavailable.
- **Evidence:** Real-database tests: setup is offered before confirmation and refused after it, and an admin reset
  re-opens setup with a new secret. With the check removed, the setup test fails.
- **Commits:** `e040199`, `2ccaf99`, `316f2ff`

### 2.19 Every signed-in user could list everyone's email address
- **Problem:** The user list endpoints returned every employee's email to any signed-in user. With a public demo
  account, that would have published real email addresses.
- **Fix:** Non-admins only see their own email. Admins, who manage users, still see all of them.
- **Evidence:** A test signs in as the demo user and as an admin and compares what each sees.
- **Commits:** `e040199`, `2ccaf99`

### 2.20 Vulnerable dependencies
- **Problem:** The build flagged `System.Security.Cryptography.Pkcs` 9.0.4 (high and moderate) and
  `Microsoft.OpenApi` 2.4.1 (high). Both came in indirectly. The first came from the SQL Server database provider,
  which the app never used because it runs on PostgreSQL.
- **Fix:** Removed the SQL Server provider, took the patch releases of Swashbuckle and ASP.NET Core OpenAPI, and the
  EF Core 10.0.14 and Npgsql 10.0.3 patch releases. `dotnet list package --vulnerable --include-transitive` now
  reports nothing.
- **Commit:** `8caaa06`

### 2.21 Build warnings and an outdated README test section
- **Problem:** The frontend production build reported 15 ESLint warnings: unused code, and React hooks with
  incomplete dependency lists. The README's test section still described the team's hand-over state.
- **Fix:** Removed the unused code. Data loaders used by effects are memoized on their real inputs, so effects
  re-run when those inputs change and not on every render. The build now compiles with no warnings. The README
  reports the current suites and freshly measured coverage.
- **Commits:** `848ebcc`, `c748ccd`

### 2.22 Session check screen
- **Problem:** While the app checked the session on opening a page, it showed the text "Verifying Session..." in
  hard-coded white, which was invisible in the light theme.
- **Fix:** A centred spinner in the theme's colours replaces the text. Screen readers still announce "Verifying
  session", and the spin slows down when the system asks for reduced motion.

### 2.23 Notifications in the app's style
- **Problem:** Notifications used react-toastify's stock look: a white card with grey generic sans-serif text and a
  rainbow progress bar, in both themes. In the dark theme they were the only white element on screen.
- **Fix:** Notifications now use the theme's surface, border, text colour and card radius, and the app's Sora font.
  Success, error, warning and information colours were chosen for each theme so icons and progress bars stay
  readable on light and dark surfaces. The close button follows the theme too.

### 2.24 Dashboard and user form labels
- **Problem:** Stock is held per branch, but the dashboard's low-stock alerts showed only the item name, so an item
  low at three branches appeared as three identical alerts. The crafting queue's "Materials" list showed the item
  being made rather than what it is made from. The user form kept the heading "Create User" while showing or
  editing an existing user.
- **Fix:** Low-stock alerts name the branch. Each job lists its recipe scaled by the order quantity (for example
  "Gear x20"), and the section is hidden for items without a recipe. The form heading reads "Create User",
  "User Details" or "Edit User" to match what the form is doing.

### 2.25 Visual consistency pass
- **Problem:** Removing a user or blueprint and resetting 2FA asked for confirmation with the browser's native
  dialog, which ignores the app's theme and fonts. On the user form, validation errors were grey rather than red,
  and several greys were hard-coded light-theme values that were faint in the dark theme. The crafting history
  statistics used the system font instead of the app's.
- **Fix:** A themed confirmation dialog (`components/common/ConfirmDialog.tsx`) styled like the inventory modals:
  focus starts on Cancel, Escape closes it, and destructive actions use a red button. The user form uses theme
  tokens and red error text in both themes, and the history statistics inherit the app font.
- **Tests:** The user page tests click the dialog's buttons, and a new test checks that Escape cancels.

### 2.26 Editing a user silently dropped branch and role changes
- **Problem:** The user form sends name, email, branch and role, but the API's update saved only name, email and
  password. Changing a user's role, or their branch together with anything else, was discarded while the app
  reported "User updated successfully". Nothing stopped the last admin being demoted or removed, which would leave
  nobody able to manage users or reset 2FA. Changing an email to one another user already had was not checked, and
  new users could be created with any role text or a branch that does not exist.
- **Fix:** One save now stores everything. The API checks that the branch exists and is not archived, that the
  role is Employee or Admin (the demo account's role cannot change), and that the email is not taken. It refuses to
  demote or remove the last admin. When admins edit their own account, their session is updated to match. The app
  shows the API's reason when a change is refused instead of a generic error.
- **Tests:** Eight unit tests cover the rules. Seven of them fail against the previous controller; the eighth checks
  that a request without branch and role keeps the current values.

### 2.27 Inventory table and filters
- **Problem:** The quantity and production-time columns sat so close together they read as one ("60 0 min"), and
  raw materials, which are not produced, showed "0 min". Choosing a category tab had no effect while a search or
  location filter was set, so a selected tab could show items from other categories. The tabs listed every built-in
  category, including empty ones, and showed unmatched categories in lower case; the Categories statistic counted the
  empty tabs. The low-stock strip only shows the signed-in user's branch but did not say so. A raw material's details
  said "No blueprint ingredients were found", which reads like an error.
- **Fix:** The columns are spaced apart, the header reads "Prod. time", and raw materials show a dash. The category
  tab always applies alongside search, status and location. Tabs, and the Categories statistic, cover only
  categories that have items, with consistent capitalisation. The strip reads "Low Stock at <branch>", and raw
  materials are described as stocked directly.
- **Tests:** One test checks the tab stays applied while searching (it fails against the previous page), and one
  checks the tabs, the Categories statistic and branch-named alerts.

### 2.28 The desktop app pointed at an API address that no longer answers
- **Problem:** The app's built-in API address was `https://artifax-5lqg.onrender.com`, but the Render service now
  lives at `https://artifax-x8pr.onrender.com`. The old address does not respond at all, so the released app, which
  has the address built in, could not sign anyone in and appeared to hang. The Render service itself was healthy.
- **Fix:** Both API clients (`services/apiClient.ts` and `hooks/useApi.ts`) default to the new address.
  `REACT_APP_API_BASE` still overrides it for local work.
- **Evidence:** `/health` on the new address returns `ok` with the database connected and the latest commit, and
  allows the dev server's origin through CORS. Frontend 55 of 55 passing with a clean type check. Signing
  in through the packaged v0.3.3 app, against the hosted API, works.

### 2.29 Login alert, dashboard loading and dead controls
- **Problem:** The login screen showed a grey "Input required / Enter details to continue." alert before anything
  had been typed. The dashboard's Active and Queued Jobs said "No active jobs" until their data arrived, so the
  counts seemed to change by themselves. In the top bar, the branch name looked like a button but did nothing, and
  the "Artifax" breadcrumb had a home icon but did not link anywhere. "First time?" on the 2FA screen was plain text
  with a click handler, so keyboard users could not reach it, and the theme toggle had no label for screen readers.
- **Fix:** The login alert only appears after a failed sign-in. The dashboard shows "Loading jobs..." until the
  first jobs request finishes. The home breadcrumb links to the dashboard and the current page is marked for screen
  readers. The branch name is a plain label. "First time?" is a button, and the theme toggle is labelled
  "Switch to light theme" or "Switch to dark theme".
- **Tests:** New tests cover each change and fail against the previous code, apart from one that checks the login
  error still appears after a failed sign-in. Frontend 60 of 60 passing with a clean type check.

### 2.30 Failures that looked like empty data, and silent order controls
- **Problem:** When a list failed to load, the error went only to the developer console and the page showed its
  normal empty state ("No active jobs", "No live inventory rows available yet"). An unreachable or sleeping server
  looked like an empty warehouse. Pause, Cancel and Expedite showed nothing when they failed. The demo account is
  refused every change, so for a visitor those buttons simply did nothing. On the free hosting tier the first
  sign-in can take up to a minute with only "Signing in..." on screen. Placeholder text was visible: a made-up
  name ("D. Dastardly") in the top bar before the real one loaded, "No users found — pull from API returned
  empty.", "Live from Orders" and "Created: Date Unknown".
- **Fix:**
  - A shared `LoadError` box ("Couldn't load inventory. The server may be waking up, or your connection may be
    down." with **Retry**) replaces the empty state when a load fails. It is used on the dashboard (inventory and
    jobs), the inventory page, Active Jobs, the crafting queue, order history, blueprints, both Analytics cards
    and the users list. Lists that refresh on a timer recover on their own once the server answers. The inventory
    page and order history also gained a loading state; before, they said "no items" while loading.
  - Pause, Cancel and Expedite show a notification when they fail, using the server's explanation when it gives
    one (`utils/apiErrors.ts`). Blueprint saves do the same. For the demo account the order controls are
    disabled, with a tooltip saying the demo is read-only.
  - After five seconds of signing in, the login screen says the server is waking up and can take up to a minute.
  - The top bar shows the user's name only once it is known. The placeholder strings are replaced with plain
    wording, or removed when there is nothing to say.
- **Tests:** New tests cover the load errors and Retry (dashboard, Active Jobs, users list), the server's reason on
  a failed pause, disabled demo controls, the slow sign-in note, the missing placeholder name, and the error
  helper. The seven new UI tests fail against the previous code. Frontend 72 of 72 passing with a clean type check.

---

## 3. Enhancement: secure, transactional crafting

Built on the `feature/secure-crafting` branch. It addresses the three most serious review findings, which needed
design changes rather than small fixes:

- **Open API:** item, stock and order endpoints work without logging in.
- **Destructive deletes:** deleting an item or employee also deletes its orders, history and other products' recipe
  lines.
- **Client-side stock changes:** materials are deducted by the app after the order is created. The server never
  checks stock, a failure leaves the order in place, and cancelling does not return materials.

### 3.1 Local Docker stack and real-database tests
- **Why first:** The existing tests use EF Core's in-memory database, which ignores foreign keys, cascade deletes and
  transactions, the exact behaviour this enhancement changes. Local work also used the hosted database.
- **Change:**
  - `docker compose up` starts PostgreSQL and the API (built from the same Dockerfile Render uses), migrated and
    seeded with demo data and a local admin. Seeding is opt-in through settings that only the compose file sets.
  - Testcontainers tests start a throwaway PostgreSQL 18 per run, with a fresh database per test.
  - The old compose file only ran the API, needed a missing `.env` file and pointed at `./backend` (wrong case on
    Linux).
- **Evidence:** Real-database tests cover migrations on an empty database, foreign-key enforcement, and seeding
  (running it twice creates no duplicates). Backend: 89 of 89 passing, 85 of them without Docker.
- **Commits:** `a82865c`, `6d630e1`, `0e55fba`
- **Follow-up:** `npm start` opens the Electron window, which expects a React dev server that nothing started,
  so it fell back to the last production build (pointing at the hosted API). Added `npm run web` for the dev
  server, made the Electron fallback use `app://artifax` like the installed app, and corrected the README steps.
  (`abf14d2`)

### 3.2 Every endpoint requires a signed-in user
- **Problem:** Only a few admin actions checked the session. Items, stock, orders, branches and the employee list,
  including deletes, worked for anyone with the API's URL.
- **Change:** An authentication handler turns the signed-in session into a standard ASP.NET Core user (email,
  name, role), and a fallback policy requires a signed-in user on every endpoint. Only the sign-in flow is public:
  login, 2FA setup, 2FA verify, logout and "who am I". A session that has passed the password step but not 2FA does
  not count as signed in. Existing admin-only checks are unchanged.
- **Evidence:** New tests send real HTTP requests through the whole API against a throwaway PostgreSQL database:
  - anonymous reads and writes get 401, and an anonymous delete leaves the item in place;
  - the password step alone does not sign in;
  - a fully signed-in user can use the API;
  - logout signs out.

  With the policy removed, 12 of the 13 tests fail. The test host never loads user-secrets, and each test asserts
  it is connected to the test container, not the hosted database. Backend: 102 of 102 passing.
- **Commits:** `086ddee`, `239040f`

### 3.3 Deletes keep history
- **Problem:** Every relationship cascaded on delete.
  - Deleting an item also deleted its orders, their history, its stock and its line in other products' recipes.
  - Deleting an employee deleted every order they had placed.
  - Deleting a branch deleted its employees, stock and orders.
  - Removing a user happened on a single click, with no confirmation.
- **Change:**
  - Items, employees and branches are **archived** instead of deleted. They leave every list, but orders still
    refer to them, so history keeps its names.
  - Archived records cannot be ordered with, and an archived employee cannot sign in.
  - The database enforces it too: orders' links to items, employees and branches, employees' link to their branch,
    and recipe lines' link to their ingredient are now `ON DELETE RESTRICT`, so even a direct delete cannot wipe
    history.
  - Removing a user asks for confirmation, and messages describe what is kept.
- **Design note:** Archived records are filtered where lists are built rather than with EF global query filters.
  Global filters would hide an archived item from its own orders' history.
- **Evidence:** Real-database tests against the demo data:
  - deleting an item keeps its orders and history, and hides it from lists;
  - deleting an ingredient leaves other recipes intact;
  - an archived item cannot be ordered;
  - deleting an employee keeps their orders and stops them signing in;
  - the database rejects a direct delete of an item with orders (`23001 restrict_violation`).

  With the old hard delete restored, the three item tests fail. Backend 107 of 107 and frontend 47 of 47 passing.
- **Deploy note:** Apply the `ArchiveInsteadOfDelete` migration to the hosted database before deploying this code.
- **Commits:** `85d93cc`, `091f831`, `cbccae8`

### 3.4 Crafting takes and returns stock on the server
- **Problem:** The app created the order, then in separate requests read and overwrote each material's stock,
  clamping at zero.
  - The server never checked stock.
  - A failed stock update left the order in place.
  - Two people crafting at once could spend the same stock.
  - Cancelling an order never returned anything.
- **Change:**
  - Placing an order reads the recipe, checks the branch has every material, deducts them and saves the order in
    one `SaveChanges`, which is one transaction. A shortage returns 409 listing what is missing, and nothing
    changes.
  - Stock rows carry a row version (PostgreSQL `xmin`). If another request changed a stock row first, the save is
    rejected instead of overwriting it.
  - The materials each order took are recorded in a new `OrderMaterials` table. Cancelling or deleting an
    unfinished order returns exactly those amounts, even if the recipe changed since, and only once.
  - Changing an order's item, quantity or branch returns its old materials to the original branch and takes the
    new amounts.
  - The craft button no longer touches stock itself, and shows the server's shortage details.
- **Evidence:** Real-database tests through the API cover each behaviour above: materials taken and recorded;
  shortages changing nothing, even for the materials that would have fitted; a single refund on cancel; refunds
  surviving a recipe change; quantity changes; deletes; concurrent orders; and a lost update being rejected. With
  the row version removed, the two concurrency tests fail in 3 of 3 runs. Also checked end to end on the local Docker
  stack: 3 brackets took 6 Steel Sheets (120 → 114), cancelling returned them, and an order for 500 was refused.
  Backend 115 of 115 and frontend 49 of 49 passing.
- **Limitation:** Orders placed before this change have no recorded materials, so cancelling one returns nothing.
- **Deploy note:** Apply the `RecordOrderMaterials` migration to the hosted database before deploying this code.
- **Commits:** `5659517`, `f64bf99`, `2ea05f6`

### 3.5 CI and a health endpoint
- **Problem:** Nothing ran the tests automatically. There was no way to tell which commit was deployed, or whether
  the API could reach its database.
- **Change:**
  - A GitHub Actions workflow (currently run manually, because Actions is unavailable on this account until a
    billing issue is resolved):
    - backend: build plus every test, including the real-PostgreSQL ones;
    - frontend: clean install, type check and tests;
    - Docker image: builds the image Render deploys.
  - `GET /health` is public and reports the deployed commit (from Render's `RENDER_GIT_COMMIT`) and whether the
    database is reachable. It returns 200 whenever the API runs, so a sleeping free-tier database does not make
    Render restart a healthy API.
- **Found along the way:** `npm ci` failed on Linux. The lock file was written by npm 11, and the npm 10 bundled
  with Node 22 rejects its handling of an optional peer dependency. CI pins npm 11.5.2 to match.
- **Evidence:** Before pushing, every CI step was run in Linux containers, which have case-sensitive paths. The
  frontend passed 49 of 49 with a clean type check, and the backend built and passed its non-Docker tests. Backend
  116 of 116 passing locally.
- **Commits:** `8edf764`, `259aa7f`

### 3.6 Read-only demo account
- **Problem:** Every account is created by an administrator, so people downloading the app from the portfolio could
  not get in.
- **Change:** A `Demo` role can sign in and read everything. Any write is refused with 403 and a "read-only"
  message. The rule is part of the global authorization policy, so it covers every endpoint. Visitors enrol their
  own authenticator: setup stays open for this account only. The app shows a read-only banner and lets the demo
  view Analytics. The account is created from two configuration settings, so production needs no manual SQL.
- **Evidence:** Real-database tests: the demo account can read every page's data, and each kind of write (create
  order, archive item, set stock, cancel order) gets 403 and changes nothing. With the read-only rule removed, the
  write test fails. Also checked on the local Docker stack. Backend 122 of 122 and frontend 52 of 52 passing.
- **Commits:** `61ea280`, `2ccaf99`, `316f2ff`

---

## 4. Known issues

- On Render's free tier the API sleeps after 15 idle minutes. Production progress only advances while it is awake.
- The Aiven free tier powers the database off after long inactivity. It must be switched back on before a demo.
