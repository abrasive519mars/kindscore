# Phase 7 — Winner verification and payout

**Goal:** a winner proves their scores with one screenshot; the admin approves or rejects with a reason; an approved win is paid and marked so. Every state change is the engine's state machine, enforced by the Phase 2 RPCs, and nobody but the winner and the admin can ever see a proof image.
**PRD:** §09 (winners only, screenshot proof, approve/reject, Pending → Paid), §10 (winnings overview: total won, payment status), §11.04 (winners list, verify, mark paid), §16.1 steps 8–9.
**Done when:** the full flow (submit → reject → resubmit → approve → paid) is proven against local Postgres + Storage through the real service as member and admin, with a cross-user read refused; the walkthrough drives it in a browser; build/lint/tests green; committed as `Phase 7: verification`.

## 0. What already exists

| Layer              | Already built                                                                                                                                                                                                                                                        | Phase 7 adds                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Engine (Phase 1)   | `verification/stateMachine.ts` — `transition(state, event)`, one resubmission                                                                                                                                                                                        | `verification/proofFile.ts` — `validateProofFile` (type, size) and the storage path convention |
| Database (Phase 2) | `winner_verifications` (read-only to clients), RPCs `submit_winner_proof` / `review_winner` / `mark_winner_paid` (each re-checks the same transition), `proofs` bucket (private; `{user_id}/…` folder policies; admin read), `publish_draw` opens one row per winner | nothing — no migration                                                                         |
| Draws (Phase 6)    | `draw_results` + `draw_entries` (what was won, with which scores)                                                                                                                                                                                                    | joined into the winnings views                                                                 |

## 1. Shape of the code

```
member action ─▶ WinnerService.submitProof(userId, verificationId, file)
                   ├─ WinnerRepository.findForUser         (own row or NotFound — never leaks another member's claim)
                   ├─ engine: validateProofFile · transition(state, "submit_proof")   (friendly refusal before any upload)
                   ├─ ProofStorage.upload(path, file)      path = {userId}/{verificationId}.{ext}  (bucket policy: own folder only)
                   └─ WinnerRepository.submitProof(id, path) → RPC submit_winner_proof
admin action  ─▶ WinnerService.review(id, approve, note) → RPC review_winner   (note required to reject)
admin action  ─▶ WinnerService.markPaid(id)              → RPC mark_winner_paid
```

Two ports, both with fakes for tests: `WinnerRepository` (rows + RPCs) and `ProofStorage` (upload + signed URL). Uploads go **through the server action** on the member's own Supabase client, so RLS and the bucket policy apply and validation lives in one place; `serverActions.bodySizeLimit` is raised to 6 MB for the 5 MB cap. Admins never download a proof — they get a 10-minute signed URL rendered in an `<img>`.

## 2. Files, in build order

### 2.1 `engine/verification/proofFile.ts` (pure)

`validateProofFile({ type, size })` → `ValidationError("Max 5 MB, PNG/JPG/WebP only", "proof")` on failure; `proofExtension(type)` → `png | jpg | webp`; `proofPath(userId, verificationId, type)`. Constants from `PROOF_UPLOAD`.

### 2.2 `repositories/interfaces/WinnerRepository.ts` + `SupabaseWinnerRepository`

```ts
interface WinningRecord { verificationId; userId; drawId; drawMonth; numbers; scores; matchCount; prizePaise;
  review: ReviewStatus; payout: PayoutStatus; resubmissions; proofPath | null; reviewNote | null; reviewedAt | null; paidAt | null; createdAt }
interface QueueRow extends WinningRecord { fullName; email }

listForUser(userId): WinningRecord[]         newest draw first
findForUser(userId, id): WinningRecord | null
listQueue(): QueueRow[]                       admin; every claim, newest first
findById(id): QueueRow | null                 admin
submitProof(id, path) · review(id, approve, note) · markPaid(id)   → RPCs; P0001 → RuleViolation, P0002 → NotFound, 42501 → Forbidden
```

One select with joins (`draw_results!inner(match_count, prize_paise, draw_entries!inner(scores), draws!inner(draw_month, numbers))`, `profiles!inner(full_name, email)` for the queue) — the RLS on each joined table still applies row by row.

### 2.3 `lib/storage/ProofStorage.ts` + `SupabaseProofStorage`

`upload(path, file: File): Promise<void>` (upsert — a resubmission replaces the old file), `signedUrl(path): Promise<string>` (600 s). Errors → `ExternalServiceError("Proof storage")`.

### 2.4 `services/WinnerService.ts`

- `listWinnings(userId)`, `getWinning(userId, id)` (NotFound when not theirs).
- `summarise(records)` (pure): `totalWonPaise` = approved (paid or pending), `paidPaise`, `awaitingPaise` (approved, pending), `unverifiedCount` — PRD §10 "total won, payment status". A rejected or unproven win is not "won" yet.
- `submitProof(userId, id, file)` as above. Returns the updated record.
- `review(id, approve, note)`: rejecting without a note → `ValidationError("Tell the member why", "note")`; note ≤ 200 chars.
- `markPaid(id)`, `listQueue()`, `getClaim(id)`, `proofUrl(path)`.

### 2.5 `components/ui/Stepper.tsx`

Horizontal stepper (DESIGN.md §2.5): filled dot = done, ring = current, hollow = future, optional caption per step. Winner steps: Awaiting proof → Submitted → Approved → Paid; a rejection renders the third step as a danger ring "Rejected" with the note. Also used by the admin claim page.

### 2.6 Member — `(member)/app/winnings/{page,actions}.tsx`, `winnings/[id]/{page,ProofForm}.tsx`

- `/app/winnings`: three figures (Total won · Paid · Awaiting payout) + the list: month, matches, prize, `Stepper`, action ("Upload proof" / "Upload again" / "Under review" / "Paid {date}"). Empty: "No winnings yet. Three matches is all it takes."
- `/app/winnings/[id]`: the claim — draw numbers vs the member's scores (matches in saffron), prize, stepper with timestamps, rejection note when present, and `ProofForm` (file input with client pre-check for type/size, preview, "Upload proof"/"Upload again") or the current proof (signed URL) while under review / after approval.
- Actions: `submitProof(formData)` → `requireUser` → service. (No `requireActiveSubscriber`: a lapsed winner is still owed their prize.)

### 2.7 Admin — `(admin)/admin/winners/{page,actions}.tsx`, `winners/[id]/{page,ReviewPanel}.tsx`

- `/admin/winners`: filter chips (All · To review · Awaiting proof · Approved, unpaid · Paid · Rejected) over one table (member, draw, matches, prize, status, updated); rows link to the claim. Empty: "Nothing to verify."
- `/admin/winners/[id]`: member + draw + scores/matches + prize, the proof image (signed URL) or "No proof yet", stepper with who/when, `ReviewPanel`: Approve / Reject (reason field appears inline) when `submitted`; Mark paid when approved & pending; nothing when paid. Illegal transitions can't be clicked, and the RPC refuses them anyway.
- Actions (`requireAdmin`): `reviewClaim`, `markClaimPaid`; `revalidatePath` for `/admin/winners`, `/admin`, `/app/winnings`, `/app`.

### 2.8 Dashboard + admin overview hook-up

Dashboard "Total won" → `summarise` (value + hint "₹X paid · ₹Y awaiting payout" / "1 win awaiting your proof"). Admin overview already shows "Proofs to review"; the link goes to the queue filtered.

### 2.9 `next.config.ts` — `experimental.serverActions.bodySizeLimit: "6mb"`.

## 3. Tests

- **Unit** `engine/verification/proofFile`: png/jpeg/webp accepted, gif/pdf refused, 5 MB accepted, 5 MB + 1 refused, path/extension mapping.
- **Unit** `services/WinnerService.test.ts` (fake repo + fake storage): submit stores `{userId}/{id}.png` and calls the RPC; wrong type / too big → ValidationError and **nothing uploaded**; not the member's claim → NotFound; `approved` state → RuleViolation before upload; reject without note → ValidationError; note > 200 → ValidationError; summary counts approved+paid only, rejected/awaiting excluded.
- **Integration** `tests/integration/winners.test.ts`: publish a draw with one winner (RPCs, as in draws.test.ts) → member uploads a real 1×1 PNG through `WinnerService` (own client) → object exists in `proofs/{id}/…`; another member's client gets nothing from `listForUser` and cannot sign a URL for that path; admin signs a URL and `review(reject, note)` → member sees the note → resubmits (resubmissions = 1) → third submit refused → approve → markPaid → `summarise` = prize paid; `reports_summary.prizes_paid_paise` reflects it.
- **Walkthrough** `scripts/walkthrough-phase7.ts`: seed as Phase 6 → publish → pick a winner → `/app/winnings` (awaiting proof) → upload a generated PNG → admin queue (To review) → claim page with the image → Reject with reason → member sees reason, uploads again → admin Approve → Mark paid → member dashboard "Total won" + Paid → 390px. Screenshots in `docs/screenshots/phase-7/`.

## 4. Order of work

1. engine file + tests → repository + storage ports → service + tests → next.config
2. integration test → Stepper → member pages + action → admin pages + actions → dashboard hook-up
3. walkthrough → docs (`GAME.md` decisions, `PLAN.md`) → commit `Phase 7: verification`

## 5. Explicitly not in this phase

Client-side WebP re-encoding (nice-to-have; the 5 MB cap is enforced). Email notifications to winners (out of PRD scope; the dashboard is the notification). Real money movement (Phase 11 notes it as "next"; the admin marks paid after paying outside the app, exactly as §09 describes). Admin editing of results (never — results are immutable).

## 6. Decisions made here

- **[decision] "Total won" means approved.** A prize counts towards the member's total once the admin has approved the proof; before that it shows as "awaiting your proof" / "under review", and a rejected claim shows why. Paid vs awaiting payout is shown separately, as §10 asks.
- **[decision] One resubmission after a rejection** (engine + RPC already enforce it); the second rejection is final and says so.
- **[decision] A rejection needs a reason** (≤ 200 characters) and the member sees it verbatim.
- **[decision] Proof images are private to the winner and admins**, served through short-lived signed URLs; nothing is ever public, and the storage path is derived from ids, never from the file name.
- **[decision] A lapsed subscriber can still claim a prize they won** while active — the win happened; the subscription gate is for playing, not for being paid.

## 7. Outcome (2026-09-21)

Done. 295 unit / 73 integration tests, build clean, walkthrough green.
Changes from the plan while building: (1) `winner_verifications` has two foreign keys to `profiles` (`user_id`, `reviewed_by`), so the joined select names `profiles!winner_verifications_user_id_fkey` explicitly — PostgREST refuses the ambiguous embed; (2) the client-side WebP re-encode was left out as planned; the 5 MB cap is enforced on both sides.
