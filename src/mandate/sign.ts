import { createHmac, timingSafeEqual } from "node:crypto";
import type { SignedWarrant, WarrantPayload } from "../domain/types.js";

// Deterministic canonical JSON — object keys sorted at every level — so the
// same payload always hashes to the same bytes regardless of how it was
// constructed. Hand-rolled instead of trusting JSON.stringify's replacer
// array, which does not reliably sort keys at nested levels.
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// Day-1 choice: HMAC-SHA256 with a shared server secret, not RSA/JOSE.
// It proves the exact same thing for this project (tamper the payload,
// the signature stops matching, the gate blocks it) with zero external
// dependencies. Swapping in asymmetric signing later only touches this
// file — the policy engine only ever calls verifyWarrant().
export function signWarrant(payload: WarrantPayload, secret: string): SignedWarrant {
  const signature = createHmac("sha256", secret).update(canonical(payload)).digest("hex");
  return { payload, signature };
}

export function verifyWarrant(signed: SignedWarrant, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(canonical(signed.payload)).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signed.signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  // Constant-time comparison — a naive === would leak signature bytes
  // through response-time differences.
  return timingSafeEqual(expectedBuf, actualBuf);
}
