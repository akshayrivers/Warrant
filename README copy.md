# Warrant

The AI can decide what it wants to do. It cannot decide what it is allowed to do.

## What's here right now (Day 1 scope only)

- `src/domain/types.ts` — the domain model: branded IDs, `Money` as integer
  minor units (never floats — Razorpay's real API requires amounts as
  integers in the smallest currency subunit anyway, so this isn't just
  internal hygiene), the `WarrantPayload`, and the decision shape.
- `src/mandate/sign.ts` — HMAC-SHA256 signing/verification over a
  hand-rolled canonical JSON encoder. Deliberately not RSA/JOSE yet: same
  guarantee (tamper the payload, the signature stops matching), zero
  external dependencies, upgradeable later without touching anything that
  calls `verifyWarrant()`.
- `src/policy/engine.ts` — `evaluate()`, the actual thesis of the project.
  Pure function: no HTTP, no database, no LLM, no Razorpay SDK. Same
  inputs, same decision, every time.
- `src/policy/engine.test.ts` — the happy path, three attack scenarios
  (limit bypass, tampered signature, replay), plus expiry / merchant
  allow-list / cumulative-limit / determinism checks. Node's built-in
  test runner — no test framework dependency.

## Deliberately NOT here yet

No Fastify/Express, no Postgres, no LLM agent, no Razorpay call, no
dashboard, no Rust. On purpose — the deterministic core has to be correct
and provably pure before anything gets layered on top of it. Everything
above will only ever *call* `evaluate()`; nothing above is allowed to
duplicate what it checks.

## Run it

```bash
npm install
npm test        # compiles, then runs the full suite
npm run typecheck
```

## Next

1. `src/catalog/` — a small deterministic merchant catalog + a
   `validateProposal()` step that runs *before* `evaluate()` (checks the
   agent's SKU/price claim against real catalog data — a different trust
   boundary from authorization, kept in its own function on purpose).
2. A thin HTTP layer (Express is fine — it's already known, no reason to
   learn Fastify this week) that: receives a proposed transaction, calls
   `validateProposal()`, then `evaluate()`, writes the decision to an
   append-only audit log, and — only on `ALLOW` — calls Razorpay
   test-mode Orders/Payments.
3. The LLM agent last, wired only to `propose_purchase()`, never to
   Razorpay directly.
