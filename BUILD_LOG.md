# Warrant — Build Log

> A chronological record of the engineering process behind Warrant.
>
> This document records decisions, experiments, failures, debugging,
> implementation progress, and lessons learned as the project is built.


# 2026-08-25 — Day 0: Project Initialization

## Objective

Establish the foundation for Warrant before implementing the actual
agentic-commerce flow.

The initial goal is deliberately narrow:

> Build and verify the deterministic policy engine before introducing
> the API, database, LLM, catalog, or payment integration.

The intention is to build the system incrementally rather than attempting
to implement the complete architecture at once.



## Initial Research

Before writing the implementation, I researched the current landscape
around agentic commerce and AI-driven payments.

The research focused on:

- Razorpay's work around agentic payments and UPI
- AP2
- ACP
- x402
- NPCI's Unified Agent Protocol (UAP)

The purpose was not to reproduce any of these systems.

Instead, I wanted to understand the existing architecture around:

- AI agent intent
- user authorization
- merchant interaction
- payment execution
- authorization boundaries
- auditability

This research led to the central question behind Warrant:

> Given an agent's proposed transaction and a user's authorization,
> how can we deterministically decide whether that transaction should
> be allowed?


## Initial Architectural Insight

The most important architectural decision at the beginning of the project
was to separate **intent from authority**.

An AI agent is useful for:

- understanding natural-language intent
- discovering products
- selecting products
- proposing transactions

However, the agent should not be trusted to determine whether it is
authorized to execute its own proposal.

Therefore:

> **AI proposes. Deterministic policy authorizes.**

The AI is treated as an untrusted proposer.

The policy engine is responsible for the authorization decision.

---

## Initial Trust Boundaries

Two different validation problems were identified.

### Proposal Validation

Determines whether the transaction proposed by the agent actually
corresponds to a valid transaction.

Examples:

- Does the SKU exist? (Stock Keeping Unit)
- Does the merchant exist?
- Is the product available?
- Is the price correct?
- Is the requested amount consistent with the catalog?

### Authorization Validation

Determines whether the transaction is permitted under the user's
authorization.

Examples:

- Is the warrant valid?
- Has it expired?
- Is this agent authorized?
- Is this merchant authorized?
- Is this category authorized?
- Is the transaction within its spending limit?
- Is the cumulative daily limit exceeded?
- Has this transaction already been processed?

These are intentionally separate trust boundaries.


# Technology Decisions

The initial stack was chosen with two constraints in mind:

1. The system should be fast to build.
2. The architecture should preserve strong boundaries and deterministic
   behavior.

### Backend / API

**TypeScript + Fastify**

TypeScript provides strict compile-time guarantees across the application
while keeping the entire API and application layer in one language.

Fastify was chosen as the HTTP framework because it provides a lightweight,
high-performance API layer with strong TypeScript support.


### Database

**PostgreSQL**

PostgreSQL will eventually store:

- warrants
- merchants
- catalog data
- transactions
- spending state
- audit events

A relational database is appropriate because these entities have explicit
relationships and the system requires transactional consistency around
authorization and spending state.


### ORM

**Drizzle ORM**

Drizzle provides a strongly typed database layer while remaining relatively
close to SQL.

This is useful for Warrant because database operations such as transaction
recording and spending-limit updates are part of the security-sensitive
path and should remain explicit.


### Frontend

**React + Vite**

The dashboard will be intentionally minimal.

Its purpose is not to demonstrate frontend complexity.

It should make the security model visible:

- warrants
- transaction proposals
- policy decisions
- blocked attempts
- successful attempts
- audit events

The interface will use a minimal monochrome visual language with light
and dark modes.


### Policy Engine

**TypeScript initially**

The policy engine is intentionally isolated from:

- HTTP
- PostgreSQL
- Fastify
- the LLM
- Razorpay

The first implementation will remain in TypeScript rather than introducing
a separate Rust or C++ service.

Rust may be considered later as an experimental optimization or benchmark,
but it is not a dependency of the initial system.

The primary performance property we care about at this stage is not raw
language-level throughput.

It is deterministic, predictable policy evaluation.


### LLM Integration

The primary application layer will remain TypeScript.

Python may be introduced later if a specific LLM-related capability is
significantly easier or more reliable to implement using Python's AI
ecosystem.

This is intentionally deferred until the deterministic authorization
layer is complete.


# Repository Foundation

The initial repository was created with strict TypeScript settings.

Important compiler constraints include:

- `strict`
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- `noImplicitOverride`
- `forceConsistentCasingInFileNames`

The intention is to catch as many type-level errors as possible before
runtime.


# Environment Issue: TypeScript / Node Types

During the initial setup, TypeScript reported an error around:

`node:assert/strict`

The initial diagnostic suggested installing `@types/node`.

`@types/node` was already installed in the project.

The actual problem was different.

VS Code was using its own bundled TypeScript version rather than the
TypeScript version installed in the project workspace.

This resulted in the editor reporting errors that the actual project
compiler did not reproduce.

### Resolution

VS Code was switched to the **workspace TypeScript version**.

After switching:

- `npm run typecheck` passed
- `npx tsc --noEmit` passed
- `npm test` passed

### Lesson

The editor's diagnostics and the project's actual compiler environment
are not necessarily the same environment.

For a reproducible TypeScript project, the workspace compiler should be
treated as the source of truth.


# Initial Policy Engine

The initial starter implementation provided a useful foundation for
testing the core policy model.

The first test suite covers eight scenarios.

### 1. Legitimate transaction

A valid warrant and valid transaction within all limits should produce:

`ALLOW`


### 2. Per-transaction limit bypass

A transaction exceeding the warrant's per-transaction limit should produce:

`BLOCK`


### 3. Tampered warrant

Changing a warrant payload without producing a corresponding valid
signature should cause signature verification to fail.

Expected result:

`BLOCK`


### 4. Transaction replay

A transaction ID that has already been processed should not be processed
again.

Expected result:

`BLOCK`


### 5. Expired warrant

A warrant past its expiration time should not authorize a transaction.

Expected result:

`BLOCK`


### 6. Unauthorized merchant

A transaction targeting a merchant outside the warrant's allow-list should
be blocked.

Expected result:

`BLOCK`


### 7. Cumulative daily limit

A transaction can be individually valid while still exceeding the
warrant's cumulative daily spending limit.

Expected result:

`BLOCK`


### 8. Determinism

Identical inputs should produce an identical policy decision.

This is particularly important because determinism is a fundamental
requirement of the system rather than merely a testing convenience.



## Initial Verification

The initial policy-engine test suite was executed successfully.

```text
tests: 8
pass: 8
fail: 0
```
## Phase 1 — Deterministic Policy Engine

Status: Complete

Implemented:
- Warrant representation
- Warrant signing and verification
- Deterministic policy evaluation
- Merchant authorization
- Category authorization
- Agent authorization
- Transaction limits
- Daily spending limits
- Expiry validation
- Replay protection
- Explicit ALLOW/BLOCK decisions

Validation:
- All policy tests passing
- Boundary conditions tested
- Determinism verified

Architectural constraint:
The policy engine has no dependency on HTTP, persistence,
LLMs, catalogs, or payment providers.

Next:
Proposal validation and catalog layer.


# 2026-08-26 — Day 1: Backend Completion

### Phase 1: Catalog & Proposal Validation
- Completed catalog representation with multiple merchants and products (`src/catalog/catalog.ts`, `types.ts`).
- Implemented proposal validation separating catalog correctness from authorization policy (`src/catalog/validate.ts`).
- 10 unit tests covering all proposal edge cases and error reasons.

### Phase 2: Domain Errors & Policy Reason Descriptions
- Implemented typed domain errors in `src/domain/errors.ts`.
- Implemented human-readable explanations and utilities for policy reasons in `src/policy/reasons.ts`.

### Phase 3: Cryptographic Audit Subsystem
- Implemented structured audit event schemas in `src/audit/events.ts`.
- Implemented SHA-256 hash chaining ensuring tamper-evident append-only audit trail.
- Implemented `InMemoryAuditRepository` and `AuditService` with integrity check capabilities.
- Added tests verifying hash continuity and tamper detection (`src/audit/service.test.ts`).

### Phase 4: Database Schema & Persistence
- Configured Drizzle ORM schemas in `src/db/schema/index.ts` for warrants, spending state, transactions, and audit logs.
- Implemented dual persistence layer (PostgreSQL via Drizzle + fast In-Memory fallback for local development and test execution) in `src/db/repositories/`.
- Repositories implemented: `WarrantRepository`, `SpendingRepository`, `TransactionRepository`, and `PgAuditRepository`.

### Phase 5: Payment Layer (Razorpay Test Mode)
- Defined payment contracts in `src/payments/types.ts`.
- Implemented `RazorpayHttpGateway` (real Razorpay REST API) and `RazorpayTestGateway` (deterministic test simulator) in `src/payments/razorpay.ts`.
- Implemented `PaymentService` in `src/payments/service.ts` with automatic audit trail logging.

### Phase 6: AI Agent & Tool Execution
- Defined `AGENT_SYSTEM_PROMPT` in `src/agent/prompts/system.ts` enforcing the untrusted proposer boundary.
- Implemented agent tools in `src/agent/tools.ts` (`search_products`, `get_product_details`, `get_merchant_catalog`, `create_transaction_proposal`).
- Implemented `AgentRunner` in `src/agent/agent.ts` with intent resolution and attack simulation modes.

### Phase 7: Fastify REST API & Endpoints
- Built Fastify application in `src/server/app.ts` with CORS, centralized error handling, and dependency injection context (`src/server/context.ts`).
- Route handlers implemented:
  - `POST /api/warrants`, `GET /api/warrants`, `GET /api/warrants/:warrantId` (`src/server/routes/warrants.ts`)
  - `GET /api/catalog`, `GET /api/catalog/merchants`, `GET /api/catalog/products` (`src/server/routes/catalog.ts`)
  - `POST /api/proposals/validate`, `POST /api/transactions/execute`, `GET /api/transactions` (`src/server/routes/transactions.ts`)
  - `GET /api/audit`, `GET /api/audit/integrity` (`src/server/routes/audit.ts`)
  - `POST /api/agent/interact`, `POST /api/agent/auto-execute` (`src/server/routes/agent.ts`)
- Standalone server entrypoint in `src/server/index.ts`.

### Phase 8: End-to-End & Adversarial Verification
- Built integration pipeline test (`src/tests/integration/pipeline.test.ts`).
- Built adversarial attack test suite (`src/tests/integration/attacks.test.ts`) verifying:
  1. Hallucinated SKU rejection
  2. Price manipulation rejection
  3. Merchant spoofing rejection
  4. Per-transaction limit enforcement
  5. Cumulative daily limit enforcement
  6. Transaction replay protection
  7. Tampered warrant signature failure
- Built E2E API tests (`src/tests/e2e/api.test.ts`).

### Test Results
```text
tests: 42
suites: 9
pass: 42
fail: 0
```


