# ADR-004: Separate Proposal Validation from Authorization

## Status

Accepted

## Date

2026-08-25

## Context

An AI-generated transaction can be invalid in two fundamentally different
ways.

First, the transaction itself may be incorrect.

For example:

- the SKU does not exist
- the merchant does not offer the product
- the price is incorrect
- the quantity is invalid

Second, the transaction may be perfectly valid but unauthorized.

For example:

- the merchant is not allowed
- the transaction exceeds the spending limit
- the warrant has expired
- the agent is not authorized
- the transaction has already been processed

These are different security questions and should not be handled by the
same component.

## Decision

Warrant will maintain two distinct validation stages:

### Stage 1 — Proposal Validation

Determines whether the proposed transaction corresponds to a valid
transaction in the available catalog.

```text
Is the SKU valid?
Is the merchant valid?
Is the price correct?
Is the quantity valid?