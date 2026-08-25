# ADR-002: Deterministic Policy Engine

## Status

Accepted

## Date

2026-08-25

## Context

The central problem Warrant attempts to solve is authorization of AI-driven
transactions.

An LLM is probabilistic and may produce different outputs for similar
inputs. It may also hallucinate merchants, products, prices, or actions.

Authorization therefore cannot depend on the LLM's own reasoning.

The authorization decision must be independently reproducible.

## Decision

Warrant will use a deterministic policy engine as the final authorization
authority.

The engine will evaluate a transaction request against:

- a spending warrant
- the current spending state
- the transaction request
- the current evaluation time

The engine will produce an explicit decision:

- `ALLOW`
- `BLOCK`

A decision must also contain a machine-readable reason.

## Determinism Invariant

Given identical inputs:

```text
warrant
transaction request
spending state
current time