# ADR-001: Technology Stack

## Status

Accepted

## Date

2026-08-25

## Context

Warrant is a time-constrained buildathon project, but the system is also
intended to demonstrate a meaningful security and authorization architecture.

The technology stack therefore needs to balance:

- implementation speed
- type safety
- runtime performance
- development complexity
- clear architectural boundaries
- ease of deployment
- ability to demonstrate the system reliably

An initial consideration was to use Rust for the policy engine because
authorization evaluation is expected to be a small, computationally
intensive component.

However, introducing Rust as a separate component would also introduce
cross-language boundaries and additional operational complexity.

## Decision

Warrant will initially use the following stack:

| Layer | Technology |
|---|---|
| API | Fastify |
| Application language | TypeScript |
| Type checking | Strict TypeScript |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Frontend | React + Vite |
| LLM integration | TypeScript initially |
| LLM fallback | Python if required |
| Payment provider | Razorpay Test Mode |

The policy engine will initially be implemented in TypeScript and remain
isolated from the infrastructure layers.

Rust may be evaluated later as an optional optimization or benchmarking
experiment, but it will not be a dependency of the initial architecture.

## Rationale

### TypeScript

TypeScript allows the API, domain model, validation layer, and policy
interfaces to share a single type system.

This reduces the possibility of schema drift between components while
allowing strict compile-time checking.

### Fastify

Fastify provides a lightweight HTTP framework with strong TypeScript
support and good runtime performance.

The API layer is not the core research problem of Warrant, so it should
remain thin and predictable.

### PostgreSQL

Warrant requires consistent state for:

- warrants
- transactions
- spending limits
- merchants
- catalog data
- audit events

PostgreSQL provides transactional guarantees and a mature relational model
for these relationships.

### Drizzle

Drizzle provides a strongly typed database abstraction while remaining
close to SQL.

This is preferable to hiding security-sensitive persistence logic behind
a heavily abstracted ORM.

### React + Vite

The frontend exists primarily to demonstrate the system rather than to
provide frontend complexity.

React provides a simple way to build the dashboard while Vite keeps the
development environment lightweight.

### Rust

Rust was considered for the policy engine because of its performance,
memory safety, and suitability for deterministic systems.

It was rejected for the initial implementation because the primary risk
is not policy evaluation performance.

The greater risk is introducing a cross-language boundary between the API
and policy engine during a short buildathon.

A separate Rust service would introduce:

- another process
- another build system
- another deployment target
- cross-language data contracts
- additional debugging complexity

The simplest architecture that demonstrates the invariant is therefore
preferred.

## Consequences

### Positive

- Fast implementation
- Single application language
- Strong type safety
- Lower integration complexity
- Easier local development
- Easier demonstration

### Negative

- Policy engine does not initially demonstrate Rust-level performance
- TypeScript policy evaluation may have lower raw throughput than a
  specialized native implementation

These trade-offs are acceptable because deterministic correctness is the
primary requirement of the policy engine.

## Revisit Conditions

The Rust decision may be revisited after the complete system works.

If revisited, the Rust implementation should use the same policy test
corpus as the TypeScript implementation and compare:

- correctness
- decision equivalence
- latency
- throughput
- implementation complexity

The Rust version should be an optimization, not a prerequisite for the
system to function.