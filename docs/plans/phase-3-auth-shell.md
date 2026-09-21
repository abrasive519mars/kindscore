# Phase 3 — Auth and the app shell

**Goal:** a person can sign up (picking a charity and their percentage), log in, log out, and land in a member area that knows _exactly_ what they may do; an admin lands in an admin area; everyone else is turned away — all enforced on the server, on every request, per PRD §04. Plus the UI primitives every later screen is built from.
**Grades:** §16.1 "User signup & login" · §04 "Real-time subscription status check on every authenticated request" · §03 role boundaries · §12 clean/modern/motion (first real screens).
**Done when:** signup → member shell (locked, "subscribe to unlock") · login/logout round-trip · `/app` without a session → `/login?next=/app` · non-admin at `/admin` → 403 page · admin sees `/admin` overview from `reports_summary` · lint/typecheck/build clean · screenshots at desktop and 390px · every file explained.

---

## 0. Who does what

| Step                                                                          | Who                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Everything in this phase                                                      | Me                                                            |
| Try the flows in a browser once I say it's up (`pnpm dev` → `localhost:3000`) | You (optional — I'll also drive it with curl and screenshots) |

No new accounts or keys. Local Supabase (Docker) for development; the cloud project is already configured.

## 1. How Supabase Auth meets Next 16 — the request lifecycle

Supabase Auth is cookie-based. Every request carries an access token (JWT, ~1 h) and a refresh token in cookies. Three places need a Supabase client, each with different cookie access:

| Client      | File                      | Cookie access                         | Used for                                                                                                            |
| ----------- | ------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **browser** | `lib/supabase/browser.ts` | `document.cookie` (automatic)         | client components that need realtime or auth events; rare                                                           |
| **server**  | `lib/supabase/server.ts`  | Next's `cookies()` — async in Next 16 | server components, server actions, route handlers — the normal case                                                 |
| **proxy**   | `lib/supabase/proxy.ts`   | the request/response objects          | refreshing an expiring token before the page renders                                                                |
| **admin**   | `lib/supabase/admin.ts`   | none — service role, bypasses RLS     | seed script, Stripe webhook, `createUser` in tests. `import "server-only"`; ESLint forbids importing it from `app/` |

`proxy.ts` (Next 16's renamed middleware) runs first on every matched request: it builds the proxy client, calls `getClaims()` (verifies the JWT locally, refreshes if needed, writes the new cookies to the response), then for `/app/**` and `/admin/**` redirects to `/login?next=…` when there's no session. It **does not** touch the database — role and subscription checks happen in layouts, where they're cached per request.

## 2. Access model — one function, called everywhere

```ts
// lib/auth/access.ts
type Access =
  | { kind: "anonymous" }
  | { kind: "member";  user; profile; subscription: SubscriptionState }   // SubscriptionState = active | past_due | cancelled | lapsed | none
  | { kind: "admin";   user; profile; subscription }

getAccess(): Promise<Access>          // React cache() — one DB round trip per request, however many callers
requireUser():   Access & kind !== anonymous   | throws AuthenticationError → redirect /login
requireAdmin():  kind === "admin"              | throws ForbiddenError → 403
requireActiveSubscriber(): member with hasActiveAccess(subscription, now)  | throws SubscriptionRequiredError
```

`getAccess` reads `profiles` + the live `subscriptions` row and runs `engine.hasActiveAccess`. Layouts call it to decide what to render; **every mutating server action calls the matching `require*`** — layouts are UX, guards are security (RLS is the last line).

**Restricted access for non-subscribers (§04):** a logged-in member without an active subscription still gets the `/app` shell — nav, profile, charity choice, the jackpot — but score entry and draw participation are locked with a "Subscribe to unlock" card. That's the deliberate reading of "restricted", not "locked out". Stripe checkout itself is Phase 5; this phase renders the locked state and the button.

## 3. Error mapping at the boundary

`lib/errors/action-result.ts`:

```ts
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code; message; field? } }
runAction(fn): Promise<ActionResult<T>>   // try/catch → AppError → { ok:false, error }; ZodError → VALIDATION with field; unknown → log + generic
```

Every server action returns `ActionResult`; forms read it with `useActionState`. Nothing throws across the client boundary. `lib/errors/http.ts` has the same mapping for route handlers (`toResponse(error)` → `Response` with the AppError's status).

## 4. Files, in build order

### 4.1 Supabase clients — `src/lib/supabase/`

- `browser.ts` — `createBrowserClient<Database>(url, anonKey)` from `clientEnv`.
- `server.ts` — `createServerClient` with `{ cookies: { getAll: () => cookieStore.getAll(), setAll: (list) => list.forEach(set) } }`; `setAll` wrapped in try/catch because server components can't set cookies (proxy already did).
- `proxy.ts` — `updateSession(request)` → `{ response, claims }`: creates the client over `request.cookies`/`response.cookies`, calls `getClaims()`.
- `admin.ts` — `import "server-only"`; `createClient<Database>(url, serviceRoleKey, { auth: { persistSession: false } })`.
- ESLint: `@/lib/supabase/admin` restricted from `src/app/**` and `src/components/**`.

### 4.2 `src/proxy.ts`

`export async function proxy(request)`: `updateSession` → if path starts with `/app` or `/admin` and no claims → redirect `/login?next=<path>`. If path is `/login` or `/signup` and there _is_ a session → redirect `/app`. `config.matcher` excludes `_next/static`, `_next/image`, `favicon`, `icon.svg`, `public/seed/**`.

### 4.3 Access + guards — `src/lib/auth/`

- `access.ts` — `getAccess()` (cached), the `Access` union, `SubscriptionState`.
- `guards.ts` — `requireUser`, `requireAdmin`, `requireActiveSubscriber`.
- `redirects.ts` — `safeNextPath(raw)`: only relative paths starting with `/` are honoured (open-redirect guard).

### 4.4 Errors — `src/lib/errors/`

- `action-result.ts` — `ActionResult`, `ok()`, `fail()`, `runAction()`.
- `http.ts` — `toResponse(error)`.
- `zod.ts` — `firstIssue(error)` → `{ field, message }`.

### 4.5 Schemas — `src/schemas/auth.ts`

- `signupSchema`: `fullName` 2–80 · `email` · `password` ≥ 8 · `charityId` uuid · `charityBps` int, `CHARITY_MIN_BPS ≤ x ≤ CHARITY_MAX_BPS`, multiple of `CHARITY_STEP_BPS` (mirrors `validateCharityBps`).
- `loginSchema`: `email`, `password`.
- Shared by the form (client validation) and the action (server validation) — one definition.

### 4.6 Auth actions — `src/app/(auth)/actions.ts`

- `signUp(prev, formData)` → `runAction`: parse → `supabase.auth.signUp({ email, password, options: { data: { full_name, charity_id, charity_bps } } })` (metadata → `handle_new_user` trigger) → `redirect("/app")`. Duplicate email → Supabase error → `ConflictError("An account with that email already exists")`.
- `logIn(prev, formData)` → `signInWithPassword` → redirect to `safeNextPath(next) ?? "/app"`. Wrong password → `AuthenticationError("Email or password is incorrect")` (deliberately not revealing which).
- `logOut()` → `signOut()` → redirect `/`.

### 4.7 Auth pages — `src/app/(auth)/`

- `layout.tsx` — centred single-column card on ivory, wordmark top-left.
- `login/page.tsx` + `LoginForm` (client; `useActionState`; inline field errors; "Create an account" link carries `next`).
- `signup/page.tsx` + `SignupForm` (client): account fields → charity picker (server-loaded list with outcome lines) → **Split slider** (10–70%, live ₹ split via `engine.splitPayment` — the signature moment from DESIGN.md §4.3) → submit. One page, three visual sections, not a wizard; plan choice + payment is Phase 5.
- `auth/callback/route.ts` — exchanges `?code=` for a session (needed for email links / OAuth later); redirects to `safeNextPath`.

### 4.8 Member shell — `src/app/(member)/app/`

- `layout.tsx` — `getAccess()`; anonymous → redirect (belt and braces with proxy); renders `AppNav` (desktop top bar: wordmark · Home · Scores · Draws · Charity · Winnings · avatar menu with Subscription/Settings/Log out) + `BottomNav` (mobile) + `SubscriptionBanner` for past_due/cancelled/lapsed + `{children}`.
- `page.tsx` — the dashboard _shell_ per DESIGN.md §5: `StatusFigure` (subscription state + renewal date), `ScoreRow` compact (hollow slots, "Enter 5 scores"), `Figure` jackpot (from `next_rollover_in` + pool — placeholder numbers until Phase 6), `CharityStat` (chosen charity + mini Split + outcome line), `WinningsStat` (₹0). Locked state: score card shows `LockedCard` "Subscribe to unlock" → `/app/subscription`.
- `subscription/page.tsx` — state card + a disabled "Subscribe · ₹499/mo" button labelled "Payments arrive in Phase 5" (honest placeholder, replaced next phase).
- `settings/page.tsx` — profile name edit (server action), theme toggle, log out.
- `not-found.tsx`, `error.tsx` per DESIGN.md §5.

### 4.9 Admin shell — `src/app/(admin)/admin/`

- `layout.tsx` — `requireAdmin()` → non-admin renders the 403 page (not a redirect, so the URL stays honest); `AdminSidebar` (Overview · Users · Draws · Charities · Winners · Reports; only Overview live this phase).
- `page.tsx` — five `Figure`s from `reports_summary` + open-draw status. Real numbers from the DB even if they're zero.
- `forbidden.tsx` — the 403 view.

### 4.10 Marketing shell — `src/app/(marketing)/`

- `layout.tsx` — `SiteNav` (Charities · How it works · Draws · Pricing · Log in · Subscribe pill) + `SiteFooter`. Nav reads `getAccess()` to swap "Log in" for "Dashboard".
- `page.tsx` — the existing token-proof page moved here (real landing is Phase 10).

### 4.11 UI primitives — `src/components/ui/`

Only what this phase's screens need; each ≤ 60 lines, tokens only, no inline hex:
`Button` (ink / saffron / ghost / danger; sizes; `pending` dots) · `Card` · `Rule` (hairline + saffron dash) · `Figure` (label + big tabular number) · `FormField` (label, input, inline error, `aria-describedby`) · `Select` · `Slider` · `Split` (static bar) + `SplitSlider` (client, live values) · `Badge` · `Banner` · `Skeleton` · `EmptyState` · `LockedCard` · `Wordmark` · `ThemeToggle`.
`src/components/nav/`: `SiteNav`, `AppNav`, `BottomNav`, `AdminSidebar`, `UserMenu`.
`src/components/motion/`: `useMotionPref()` hook, `FadeIn` (12px rise, 600ms, once).

### 4.12 Theme

`src/app/globals.css` gains focus/utility classes as needed; `ThemeToggle` writes `localStorage["kindscore-theme"]` + `data-theme` (the init script from Phase 0 reads it back).

## 5. Tests

| Kind                 | File                                   | Proves                                                                                                                                                  |
| -------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit                 | `tests/unit/lib/action-result.test.ts` | AppError → `{ok:false, code, status}`; ZodError → VALIDATION + field; unknown → generic, no leak of the message                                         |
| unit                 | `tests/unit/lib/redirects.test.ts`     | `safeNextPath`: `/app/scores` ok; `//evil.com`, `https://x`, `javascript:` rejected                                                                     |
| unit                 | `tests/unit/schemas/auth.test.ts`      | signup schema boundaries (bps 1000/7000 ok, 900/7100/1050 not; password 7 chars fails)                                                                  |
| unit                 | `tests/unit/lib/access.test.ts`        | `deriveAccess(profile, subscription, now)` (the pure part of `getAccess`) → anonymous / member locked / member active / admin                           |
| integration          | `tests/integration/auth.test.ts`       | public `signUp` with metadata creates a profile with that charity/bps; wrong password fails; duplicate email fails                                      |
| manual + screenshots | —                                      | signup → `/app` locked shell; login/logout; `/app` unauthenticated → `/login?next=/app`; member at `/admin` → 403; admin overview renders; 390px layout |

## 6. Order of work

1. `lib/supabase/*` + `proxy.ts` → dev server boots, `/app` redirects to `/login`
2. `lib/errors/*`, `lib/auth/*`, `schemas/auth.ts` + unit tests
3. UI primitives + nav + motion
4. Auth pages + actions → signup/login/logout work against local Supabase
5. Member shell + dashboard placeholder + subscription/settings pages
6. Admin shell + overview + 403
7. Marketing layout
8. Integration test, screenshots, `pnpm build`, commit `Phase 3: auth + shell`

## 7. Explicitly not in this phase

Stripe checkout (5). Score entry (4). Draw pages (6). Winnings (7). Charity directory (8). Admin users/reports beyond the overview (9). The real landing page (10). Seeded personas (11).

## 8. Decisions made here (add to GAME.md / README decisions table)

- **[decision] Restricted access = locked shell, not lockout.** A non-subscriber sees the app, their charity and the jackpot, and one clear button. Matches §04 "restricted access" better than a redirect wall and makes the subscribe CTA prominent (§12).
- **[decision] Signup is one page** (account · charity · percentage). Plan and payment follow _after_ the account exists, so an abandoned checkout still leaves a member we can win back — and so the split slider is seen before any money is asked for.
- **[decision] Login errors don't reveal whether the email exists.** Standard practice; noted so the evaluator doesn't read it as a bug.
