# Warrant — 5-Minute Video Pitch & Demo Script

> **Submission for Razorpay AI Buildathon**  
> **Tagline:** *The AI can decide what it wants to do. It cannot decide what it is allowed to do.*

---

## ⏱️ Video Breakdown & Narrative Arc (0:00 – 5:00)

```
[0:00 - 0:45] The Problem & The Core Thesis (Separation of Intent & Authority)
[0:45 - 1:30] Architecture: The Signed Spending Warrant & Dual Trust Boundaries
[1:30 - 2:30] Live Demo 1: Legitimate Intent -> Proposal -> Policy -> Razorpay Payment
[2:30 - 3:45] Live Demo 2: Adversarial Attacks (Price Manipulation, Tampering) & Agent Revision Loop
[3:45 - 4:30] Cryptographic Audit Trail: SHA-256 Tamper-Evident Hash Chain
[4:30 - 5:00] Conclusion & The Future of Secure Agentic Commerce
```

---

### **[0:00 – 0:45] 1. The Hook & The Problem**
- **Visual:** Camera on presenter + screen showing the Warrant Console header:  
  `WARRANT — Deterministic Authorization Console • Agentic Commerce`
- **Script:**
  > *"Hi everyone, I'm presenting **Warrant** — a deterministic authorization layer for agentic commerce.*
  >
  > *With emerging protocols like AP2, ACP, and NPCI's Unified Agent Protocol, AI agents can now interact with commerce APIs and initiate payments on behalf of users.*
  >
  > *However, this creates a dangerous security vulnerability: **Who decides what the AI is allowed to spend?***
  >
  > *LLMs hallucinate, suffer from prompt injection, and are inherently non-deterministic. Giving an AI agent direct payment credentials or wallet access is an unacceptable financial risk.*
  >
  > *Warrant introduces a foundational architectural separation: **AI proposes. Deterministic policy authorizes.**"*

---

### **[0:45 – 1:30] 2. The Core Primitives**
- **Visual:** Navigate to **[1] DASHBOARD**, highlighting the active Spending Warrant card and Spending State.
- **Script:**
  > *"Warrant introduces two fundamental primitives:*
  >
  > *First, the **Signed Spending Warrant** — an immutable, cryptographically sealed JSON instrument signed via HMAC-SHA256 by the user or organization. It specifies authorized agent IDs, allow-listed merchants, approved categories, per-transaction limits, and cumulative daily limits.*
  >
  > *Second, **Two-Stage Validation Separation** (ADR-004):*
  > 1. *Stage 1 — **Proposal Validation**: independently checks against the merchant catalog to verify the product SKU is real, available, and the proposed price has not been altered.*
  > 2. *Stage 2 — **Deterministic Policy Engine**: verifies HMAC signature integrity, expiration window, merchant allow-lists, per-transaction ceiling, daily budget, and replay guards.*
  >
  > *The LLM is strictly an **untrusted proposer** — it never touches the payment gateway directly."*

---

### **[1:30 – 2:30] 3. Live Demo 1: Legitimate Agent Interaction & Razorpay Execution**
- **Visual:** Switch to **[2] AGENT**. Type: `"Buy 2L fresh milk from FreshMart"`. Show Gemini extracting intent and formulating the proposal, then click **Check Authorization** → transition to **[3] DECISION**.
- **Script:**
  > *"Let's see it in action.*
  >
  > *I prompt the agent: 'Buy 2 litres of fresh milk from FreshMart.'*
  > *Our Gemini-powered agent executes tool calls against the catalog, locates SKU `milk-2l` at ₹12.84, and formulates a structured proposal under Warrant `w_e2e_01`.*
  >
  > *On the Decision Screen, watch the pipeline evaluate:*
  > - *Stage 1 verifies against the merchant catalog: SKU verified, authoritative price ₹12.84 confirmed.*
  > - *Stage 2 evaluates all 9 policy invariants deterministically: HMAC valid, merchant allowed, limit satisfied.*
  > - *Verdict: **ALLOW — OFFICIALLY AUTHORIZED**.*
  >
  > *Only after strict policy clearance does Warrant invoke the **Razorpay API** (Test Mode), creating a real Razorpay Order ID and Payment ID, visible right here on the receipt."*

---

### **[2:30 – 3:45] 4. Live Demo 2: Adversarial Attacks & Policy Feedback Loop**
- **Visual:** Return to **[2] AGENT**. Set the **Adversarial Demo Switch** to `[ATTACK DEMO] Price Tampering`. Enable `AUTO-EXECUTE PIPELINE`. Submit the prompt.
- **Script:**
  > *"Now let's see what happens during adversarial conditions or agent hallucination.*
  >
  > *I will simulate a **Price Manipulation Attack**, where an agent attempts to understate a product's price to bypass spending limits.*
  >
  > *Watch the pipeline: Stage 1 catalog validation immediately detects that the proposed price differs from the authoritative catalog price and issues an instant **BLOCK**.*
  >
  > *Crucially, Warrant provides a **Policy Feedback Loop**: the structured, deterministic block reason is fed back to Gemini. The agent automatically revises its proposal within valid constraints, resubmits to the policy engine, and achieves an authorized state on Attempt 2 — all without ever gaining unauthorized execution power.*
  >
  > *Similarly, if anyone attempts to tamper with warrant parameters in the database, HMAC-SHA256 signature verification fails instantly with `INVALID_SIGNATURE`."*

---

### **[3:45 – 4:30] 5. Cryptographic Audit Trail**
- **Visual:** Switch to **[4] AUDIT TRAIL**. Click **"Verify Hash Chain"** to show the green `VERIFIED (X Events Sealed)` badge. Click **"Inspect Payload"** on an event to reveal the SHA-256 hash link.
- **Script:**
  > *"Every single lifecycle event — warrant issuance, proposal receipt, catalog validation, policy evaluation, and Razorpay payment status — is committed to an **append-only SHA-256 cryptographic hash chain**.*
  >
  > *Clicking 'Verify Hash Chain' mathematically checks every block against its parent hash. If any database row is modified post-hoc, the chain link breaks visibly.*
  >
  > *This provides enterprise-grade non-repudiation, dispute resolution, and forensic auditing for agentic commerce."*

---

### **[4:30 – 5:00] 6. Conclusion & Pitch Closing**
- **Visual:** Return to **[1] DASHBOARD** or title slide showing tech stack badges (TypeScript, Fastify, PostgreSQL/Drizzle, Google Gemini, Razorpay).
- **Script:**
  > *"To summarize: As agentic commerce expands across UPI, Razorpay, AP2, and UAP, security cannot be left to probabilistic system prompts.*
  >
  > ***Warrant** provides the missing cryptographic and deterministic authorization rails — giving users, merchants, and fintech platforms mathematical certainty over AI spending.*
  >
  > *Thank you!"*
