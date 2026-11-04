# Portfolio changes

Artifax started as a team project. This repository continues from the team's final commit,
[`e64466e`](https://github.com/MarioOjo/Artifax/commit/e64466e), and this document records every change
made since then, so it is clear what differs from the original.

Each entry says what was wrong, why it mattered, what changed, and the commit that changed it.

| Area | Changes |
| --- | --- |
| [1. Running on new infrastructure](#1-running-on-new-infrastructure) | 4 |
| [2. Bug fixes from a code review](#2-bug-fixes-from-a-code-review) | 17 |
| [3. Enhancement: secure, transactional crafting](#3-enhancement-secure-transactional-crafting) | planned |
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

Items 2.14 to 2.17 were found while bringing the tests up to date.

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

---

## 3. Enhancement: secure, transactional crafting

Planned. It addresses the three most serious review findings, which need design changes rather than small fixes:

- **Open API:** item, stock and order endpoints work without logging in.
- **Destructive deletes:** deleting an item or employee also deletes its orders, history and other products' recipe
  lines.
- **Client-side stock changes:** materials are deducted by the app after the order is created. The server never
  checks stock, a failure leaves the order in place, and cancelling does not return materials.

---

## 4. Known issues

- On Render's free tier the API sleeps after 15 idle minutes. Production progress only advances while it is awake.
- The Aiven free tier powers the database off after long inactivity. It must be switched back on before a demo.
