# Warrant
>The AI can decide what it wants to do. It cannot decide what it is allowed to do 

[![CI](https://github.com/akshayrivers/Warrant/actions/workflows/ci.yml/badge.svg)](https://github.com/akshayrivers/Warrant/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is Warrant?
Warrant is a deterministic authorization layer for agentic commerce.

An AI agent can understand the user's intent, discover products and propose a transaction. But an AI agent should not have the authority to decide whether that transaction is permitted.

Warrant introduces a signed *spending warrent* and a deterministic policy engine between the AI agent and the payment provider.

The agent proposes a transaction. Warrant independently verifies the proposal evaluates it against the user's authorization constraints, and produces an explicit **ALLOW** or **BLOCK** decision before the transaction can reach the payment system.

Every decision is recorded in an auditable trail.

## Problem Statement
AI agents are increasingly capable of acting on behalf of users, including making purchases and interacting with payment systems.

This introduces a fundamental authorization problem: 
> How do we ensure that that an AI agent can act on a user's behalf without allowing the agent itself to determine what it is authorized to do?

An agent may produce a valid looking transaction while exceeding the spending limit, using an unauthorized merchant, replaying a previous transaction, or operating under an expired or tampered authorization.

Warrant separates **intent from authority**

The AI determinse what it wants to do.
Warrant determines whether it is allowed to do it.

## Research and Context
Warrant was motivated by the emerging ecosystem around agentic commerce, where AI agents can discover products and eventually execute transactions on behalf of users.
Before designing Warrant, I examined Razorpay's work in agentic payements as well as the emerging protocols such as **AP2, ACP, x402 and NPCI's Unified Agent Protocol (UAP).**

The goal was not to reproduce an existing payment system. It was to understand where **agent intent, authorization, payment execution and auditability** meet.

### Razorpay and agentic UPI
Razorpay and NPCI have aready demonstrated an agentic UPI flow in which AI agents can facilitate purchases through conversational interfaces. The launch involved merchants including Zomato, Swiggy and Zepto, with a consent-based model intended to prevent the agent from obtaining unrestricted access to user's money.

The important observation for warrant is not simply than an AI can make a payment.

It is that **AI driven payments require an explicit authorization model.**

The user must establish what the agent is allowed to do, while the payment system must remain capable of enforcing those constraints.

Warrent took this idea as a strating point and asked: 
> What would an independently verifiable, deterministic authorization layer for agentic commerce look like?
Rather than tying authorization to a particualr agent, merchant, or interface, Warrant models authorization as a signed spending warrant that can be evaluated independently.

### Emerging Protocols:
Several protocols are approaching different parts of the agentic-commerce problem:
| Protocol     | Primary Focus       |
| ------------ | ----------------------------------------------------------------- |
| **AP2**      | Authorization and proof of user intent for agentic payments       |
| **ACP**      | Agent-to-merchant commerce interactions                           |
| **x402**     | Machine-to-machine payment over HTTP                              |
| **NPCI UAP** | Agent identity, authorization, and UPI-based agentic transactions |

These protocols should not be viewed as competing implementations of the same thing. Instead they operate at different layers of the emerging agentic-commerce stack.

Warrant is intentionally narrower.

It focuses on the question: 
> Given an agent's proposed transaction and user's authorization, should this specific transaction be allowed?

That decision must be: 
- deterministic
- independenlty verifiable
- bounded by explicit policy
- resistant to tampering and replay 
- auditable after execution

## Research: Design Decisions
This research led to several design principles.

1. **AI is not an authorization authority**
An LLM can generate a transaction proposal, but its output cannot directly authorize payment. 
2. **Authorization must be explicit**
A spending warrant defines the boundaries within an agent may operate.
3. **Policy evaluation must be deterministic**
Given identical:
- warrant 
- transaction request
- spending state
- current time
the policy engine should produce the same decision.
4. **Validation and authorization are separate**
A transaction proposal must first establish that the requested product, merchant, SKU, and price are valid.

Only then should authorization be evaluated.
This created two distinct boundaries: 
```
AI proposal
     │
     ▼
┌─────────────────────┐
│ Proposal Validation │
│                     │
│ Is it real?         │
│ Is the price real?  │
│ Is the SKU valid?   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Policy Engine       │
│                     │
│ Is it authorized?   │
└──────────┬──────────┘
           │
       ALLOW/BLOCK
```
5. **Payment execution only happens after authorization**
The payment provider should never be directly controlled by the LLM. 



## Core Thesis
### AI proposes. Deterministic policy authorizes.
The LLM is treated as an **untrusted proposer**, not an authority.

A transaction must pass thorugh independent validation and authorization before reaching the payment provider: 
```
User
  │
  │ authorization
  ▼
Warrant
  │
  │ signed spending warrant
  ▼
AI Agent
  │
  │ transaction proposal
  ▼
Proposal Validation
  │
  │ valid product / merchant / price
  ▼
Deterministic Policy Engine
  │
  ├── warrant valid?
  ├── warrant expired?
  ├── agent authorized?
  ├── merchant authorized?
  ├── category authorized?
  ├── transaction limit?
  ├── cumulative limit?
  └── replay?
  │
  ├───────────────┐
  │               │
 ALLOW           BLOCK
  │               │
  ▼               ▼
Razorpay        Audit Log
Test Mode
  │
  ▼
Audit Log
```
The LLM never gets direct payment authority.

## Current Status
Phase: Project initialization

The repository and development environment have been established.

### Completed
Project skeleton established
Strict TypeScript configuration
Node.js type definitions configured
Workspace TypeScript version configured
Build successfully compiling
Type checking passing
Initial policy-engine test suite passes
Initial attack scenarios identified
Architecture and technology direction established
### Current focus

Building the **deterministic** policy engine before introducing:

1. Fastify API
2. PostgreSQL persistence
3. Catalog and proposal validation
4. Razorpay Test Mode
5. LLM agent
6. React dashboard

The policy engine is deliberately being developed independently of HTTP, databases, LLMs, and payment providers.

## High Level Architecture: 
```
                         ┌──────────────────┐
                         │   React + Vite   │
                         │    Dashboard     │
                         └────────┬─────────┘
                                  │
                                  │ HTTP
                                  ▼
                         ┌──────────────────┐
                         │     Fastify      │
                         │   API Layer      │
                         └────────┬─────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
       ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
       │   Catalog   │    │  PostgreSQL  │    │    Agent    │
       │             │    │   + Drizzle  │    │    / LLM    │
       └──────┬──────┘    └──────────────┘    └──────┬──────┘
              │                                       │
              │             proposal                  │
              └───────────────────┬───────────────────┘
                                  ▼
                       ┌─────────────────────┐
                       │ Proposal Validation │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │   Policy Engine     │
                       │                     │
                       │   DETERMINISTIC     │
                       │                     │
                       │   ALLOW / BLOCK     │
                       └──────────┬──────────┘
                                  │
                              ALLOW only
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │  Razorpay Test Mode │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │     Audit Log       │
                       └─────────────────────┘
```

### Arcitectural Boundary
The most important boundary in the system is: 
```
             UNTRUSTED                         TRUSTED
                │                                │
                ▼                                ▼

        ┌──────────────┐                 ┌───────────────┐
        │   AI Agent   │                 │ Policy Engine │
        │              │                 │               │
        │ "I want to   │ ── proposal ──► │ "Are you      │
        │  buy this."  │                 │  allowed?"    │
        └──────────────┘                 └───────┬───────┘
                                                 │
                                          ALLOW / BLOCK
                                                 │
                                                 ▼
                                             Payment
```
**The agent can influence the transaction proposal, but it cannot influence teh authorization decision.**

That seperation is the central architectural principle of Warrant.

## Documentation

Warrant is being documented as it is built rather than reconstructed after implementation.

### Architecture

See /docs/architecture for detailed architectural documentation.

### Architecture Decision Records

See /docs/decisions for the decisions made during development, including alternatives considered and the reasoning behind each decision.

### Build Log

See /BUILD_LOG.md for the chronological engineering log, including implementation progress, failures, debugging, experiments, and lessons learned.

### Buildathon Pitch

See [docs/pitch/5-minute-video-pitch.md](docs/pitch/5-minute-video-pitch.md) for the complete 5-minute demonstration script prepared for the Razorpay AI Buildathon submission.

#### 5-Minute Video Pitch Breakdown:
1. **[0:00 – 0:45] The Problem**: Why giving LLMs direct payment authority creates critical financial vulnerabilities.
2. **[0:45 – 1:30] Architecture**: Signed Spending Warrants (HMAC-SHA256) & Dual Trust Boundaries (Proposal Validation vs Policy Authorization).
3. **[1:30 – 2:30] Live Demo (Happy Path)**: Gemini agent intent extraction → Catalog validation → Policy engine ALLOW → Razorpay Test Mode execution.
4. **[2:30 – 3:45] Live Demo (Adversarial)**: Simulating price manipulation / limit bypass attacks, deterministic BLOCK decisions, and the Agent Revision Loop.
5. **[3:45 – 4:30] Audit Trail**: Append-only SHA-256 cryptographic hash chain verification.
6. **[4:30 – 5:00] Conclusion**: Mathematical certainty for agentic commerce.

## Disclaimer

Warrant is a buildathon project and research prototype. It is not intended
for processing real financial transactions. Payment interactions use
Razorpay's Test Mode during development.