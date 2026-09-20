# Digital Heroes PRD (Level 1) — verbatim transcription

> Source: `Digital Heroes PRD (Level 1).pdf`, Version 1.0 · March 2026 · Issued for selection process only.
> Transcribed 2026-09-20. The PDF file contains 13 pages; the page numbered **11 / 14** (§13 Technical requirements, §14 Scalability considerations) is **missing from the file**. Everything else is reproduced as written.

---

## Cover (page 01)

§ 00 · PRODUCT REQUIREMENTS · 2026 EDITION · DIGITALHEROES.CO.IN

**PRODUCT REQUIREMENTS DOCUMENT · SAMPLE ASSIGNMENT**

# Digital Heroes PRD (Level 1)

A golf performance and charity draw platform brief for full-stack development trainees. Edition 2026

Six core objectives, one owned platform. This document is the single source of truth for what you are asked to design, build, and ship during the selection process.

VERSION 1.0 · MARCH 2026 · ISSUED FOR SELECTION PROCESS ONLY

---

## § 01 · Contents (page 02)

**What's inside.** Sixteen sections covering the full product specification — from platform overview through evaluation criteria. Read in order, or jump to what you need.

| § | Section | Page |
|---|---|---|
| 01 | Project overview | 03 |
| 02 | Core objectives | 03 |
| 03 | User roles | 04 |
| 04 | Subscription & payment | 05 |
| 05 | Score management | 05 |
| 06 | Draw & reward system | 06 |
| 07 | Prize pool logic | 06 |
| 08 | Charity system | 07 |
| 09 | Winner verification | 08 |
| 10 | User dashboard | 08 |
| 11 | Admin dashboard | 09 |
| 12 | UI / UX requirements | 10 |
| 13 | Technical requirements | 11 |
| 14 | Scalability considerations | 11 |
| 15 | Mandatory deliverables | 12 |
| 16 | Evaluation criteria | 13 |

### § 02 · Document summary

This PRD outlines the complete product specification, combining performance tracking, monthly prize draws, and charitable giving. Prepared by Digital Heroes as a sample assignment for evaluating full-stack development trainees during the selection process, it serves as the single source of truth for design, development, and evaluation.

---

## § 01 · Project overview (page 03)

**The platform.**

A subscription-driven web application combining golf performance tracking, charity fundraising, and a monthly draw-based reward engine — built to feel emotionally engaging and modern, deliberately avoiding the aesthetics of a traditional golf website.

### § 01.1 · What users do

- Subscribe to the platform (monthly or yearly)
- Enter their latest golf scores in Stableford format
- Participate in monthly draw-based prize pools
- Support a charity of their choice with a portion of their subscription

## § 02 · Core objectives

| Tag | Objective | Description |
|---|---|---|
| ENGINE | Subscription | Build a robust subscription and payment system. |
| EXPERIENCE | Score entry | Simple, engaging score-entry flow. |
| ENGINE | Custom draw | Algorithm-powered or random monthly draws. |
| INTEGRATION | Charity | Seamless charity contribution logic. |
| CONTROL | Admin | Comprehensive admin dashboard and tools. |
| DESIGN | Outstanding UI/UX | A look that stands out in the golf industry. |

---

## § 03 · User roles (page 04)

**Who uses it.** Three roles, each with a defined boundary of access — from anonymous browsing to full platform control.

### Role 01 · Public visitor
- View platform concept
- Explore listed charities
- Understand draw mechanics
- Initiate subscription

### Role 02 · Registered subscriber
- Manage profile & settings
- Enter / edit golf scores
- Select charity recipient
- View participation & winnings
- Upload winner proof

### Role 03 · Administrator
- Manage users & subscriptions
- Configure & run draws
- Manage charity listings
- Verify winners & payouts
- Access reports & analytics

---

## § 04 · Subscription & payment system (page 05)

**Subscribe. Score.**

| | |
|---|---|
| PLANS | Monthly plan and yearly plan (discounted rate) |
| GATEWAY | Stripe (or equivalent PCI-compliant provider) |
| ACCESS CONTROL | Non-subscribers receive restricted access to platform features |
| LIFECYCLE | Handles renewal, cancellation, and lapsed-subscription states |
| VALIDATION | Real-time subscription status check on every authenticated request |

## § 05 · Score management system

### Input requirements
- Users must enter their last 5 golf scores
- Score range: 1–45 (Stableford format)
- Each score must include a date

### Functional behaviour
- Only the latest 5 scores are retained at any time
- A new score replaces the oldest stored score automatically
- Scores display in reverse chronological order (most recent first)

> **Note:** Only one score entry is permitted per date. Duplicate scores for the same date are not allowed — an existing entry may only be edited or deleted.

---

## § 06 · Draw & reward system (page 06)

**The draw.**

### Draw types
- 5-number match
- 4-number match
- 3-number match

### Draw logic
- Random — standard lottery-style
- Algorithmic — weighted by score frequency

### Operations
- Monthly cadence
- Admin controls publishing
- Simulation before publish
- Jackpot rollover if unclaimed

## § 07 · Prize pool logic

A fixed portion of each subscription contributes to the prize pool. Distribution is pre-defined and enforced automatically.

| Match type | Pool share | Rollover? |
|---|---|---|
| 5-Number match | 40% | Yes — jackpot |
| 4-Number match | 35% | No |
| 3-Number match | 25% | No |

- Auto-calculation of each pool tier based on active subscriber count
- Prizes split equally among multiple winners in the same tier
- 5-match jackpot carries forward if unclaimed

---

## § 08 · Charity system (page 07)

**Give back.** Charitable impact leads the platform's story. Every subscriber directs part of their fee to a cause they choose.

### § 08.1 · Contribution model
- Users select a charity at signup
- Minimum contribution: 10% of subscription fee
- Users may voluntarily increase their charity percentage
- Independent donation option, not tied to gameplay

### § 08.2 · Charity directory features

| Tag | Feature | Description |
|---|---|---|
| DISCOVERY | Directory | Charity listing page with search and filter. |
| DETAIL | Profiles | Description, images, and upcoming events such as golf days. |
| HOMEPAGE | Spotlight | Featured charity section on the homepage. |

---

## § 09 · Winner verification system (page 08)

**Verify. Display.**

| | |
|---|---|
| ELIGIBILITY | Verification process applies to winners only |
| PROOF UPLOAD | Screenshot of scores from the golf platform |
| ADMIN REVIEW | Approve or reject submission |
| PAYMENT STATES | Pending → Paid |

## § 10 · User dashboard

Must include all of the following:

- ✓ Subscription status — active / inactive / renewal date
- ✓ Score entry and edit interface
- ✓ Selected charity and contribution percentage
- ✓ Participation summary — draws entered, upcoming draws
- ✓ Winnings overview — total won and current payment status

---

## § 11 · Admin dashboard (page 09)

**Full control.** Five control surfaces cover every operational need — from user management through reporting.

### 01 · User management
- View and edit user profiles
- Edit golf scores
- Manage subscriptions

### 02 · Draw management
- Configure draw logic (random vs. algorithm)
- Run simulations
- Publish results

### 03 · Charity management
- Add, edit, delete charities
- Manage content and media

### 04 · Winners management
- View full winners list
- Verify submissions
- Mark payouts as completed

### 05 · Reports & analytics
- Total users
- Total prize pool
- Charity contribution totals
- Draw statistics

---

## § 12 · UI / UX requirements (page 10)

**Feel, not fairway.** The platform must not resemble a traditional golf website. Design must be emotion-driven — leading with charitable impact, not sport.

| | |
|---|---|
| FEEL | Clean, modern, motion-enhanced interface |
| AVOID | Golf clichés — fairways, plaid, club imagery as primary design language |
| HOMEPAGE | Clearly communicates what the user does, how they win, charity impact, and the call to action |
| ANIMATIONS | Subtle transitions and micro-interactions throughout |
| CTA | Subscribe button / flow must be prominent and persuasive |

---

## § 13 · Technical requirements · § 14 · Scalability considerations (page 11 — MISSING)

> This page is not present in the PDF file supplied. Only the contents entry (§13 Technical requirements, §14 Scalability considerations, page 11) is known. The stack is therefore constrained only by § 15.1 below.

---

## § 15 · Mandatory deliverables (page 12)

**What to ship.**

| | |
|---|---|
| LIVE WEBSITE | Fully deployed, publicly accessible URL |
| USER PANEL | Test credentials; signup / login / score entry / dashboard all functional |
| ADMIN PANEL | Admin credentials; user management, draw system, charities, winner verification |
| DATABASE | Backend connected (e.g. Supabase) with proper schema |
| SOURCE CODE | Clean, structured, well-commented codebase |

### § 15.1 · Deployment constraints
- Deploy to a new Vercel account (not personal/existing)
- Use a new Supabase project (not personal/existing)
- Environment variables must be properly configured

---

## § 16 · Evaluation criteria (page 13)

**How we judge.**

| Criterion | What it measures |
|---|---|
| Requirements interpretation | How accurately the team translates requirements into features |
| System design | Quality of architecture decisions and data modelling |
| UI/UX creativity | Originality, polish, and emotional engagement of the interface |
| Data handling | Accuracy of score logic, draw engine, and prize calculations |
| Scalability thinking | Extensibility of the codebase and data structures |
| Problem-solving | How ambiguous requirements are identified and resolved |

### § 16.1 · Testing checklist
- ✓ User signup & login
- ✓ Subscription flow (monthly and yearly)
- ✓ Score entry — 5-score rolling logic
- ✓ Draw system logic and simulation
- ✓ Charity selection and contribution calculation
- ✓ Winner verification flow and payout tracking
- ✓ User dashboard — all modules functional
- ✓ Admin panel — full control and usability
- ✓ Data accuracy across all modules
- ✓ Responsive design on mobile and desktop
- ✓ Error handling and edge cases

---

## § 17 · About this document (page 14)

**Build it well.** This PRD is the single source of truth for design, development, and evaluation during the trainee selection process. Read it in full before starting — ambiguity is part of the test.

### § 17.1 · Document details

| | |
|---|---|
| ISSUED BY | Digital Heroes · digitalheroes.co.in |
| DOCUMENT TYPE | Product Requirements Document (PRD) |
| PURPOSE | Trainee selection process — sample assignment |
| VERSION | 1.0 · March 2026 |
| AUDIENCE | Full-stack development trainees / applicants |

SAMPLE DOCUMENT · ISSUED FOR SELECTION PROCESS ONLY — End of PRD · 2026 Edition —
