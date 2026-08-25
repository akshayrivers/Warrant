# ADR-003: Treat the AI Agent as an Untrusted Proposer

## Status

Accepted

## Date

2026-08-25

## Context

The AI agent is responsible for translating user intent into an actionable
transaction.

For example:

> "Buy me two litres of milk from an approved grocery store."

The agent may determine:

- which merchant to use
- which SKU to select
- quantity
- transaction details

However, an LLM cannot be treated as an authorization authority.

LLMs can hallucinate information, misinterpret instructions, or produce
unexpected outputs.

Giving the agent direct access to payment execution would therefore combine
intent generation and authorization into the same trust boundary.

## Decision

The AI agent will be treated as an **untrusted proposer**.

The agent may produce a transaction proposal.

It may not directly execute payment or determine whether the transaction is
authorized.

All proposals must pass through Warrant before payment execution.

## Flow

```text
User Intent
    │
    ▼
AI Agent
    │
    │ transaction proposal
    ▼
Proposal Validation
    │
    ▼
Policy Engine
    │
    ├── ALLOW
    │     │
    │     ▼
    │   Payment
    │
    └── BLOCK
          │
          ▼
       Audit Log