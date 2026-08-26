import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { InMemoryAuditRepository } from "../audit/repository.js";
import { AuditService } from "../audit/service.js";
import { asTransactionId, asWarrantId, money } from "../domain/types.js";
import { RazorpayTestGateway } from "./razorpay.js";
import { PaymentService } from "./service.js";

describe("Payment Service & Gateway", () => {
  test("creates order and executes test payment successfully", async () => {
    const auditRepo = new InMemoryAuditRepository();
    const auditService = new AuditService(auditRepo);
    const gateway = new RazorpayTestGateway();
    const paymentService = new PaymentService(gateway, auditService);

    const result = await paymentService.processPayment({
      transactionId: asTransactionId("tx_pay_1"),
      warrantId: asWarrantId("w_pay_1"),
      merchantId: "freshmart",
      amount: money(1284),
    });

    assert.equal(result.status, "SUCCESS");
    assert.ok(result.paymentId.startsWith("pay_test_"));
    assert.ok(result.orderId.startsWith("order_test_"));

    const auditEvents = await auditService.query({ transactionId: asTransactionId("tx_pay_1") });
    assert.equal(auditEvents.length, 2);
    assert.equal(auditEvents[0]?.eventType, "PAYMENT_INITIATED");
    assert.equal(auditEvents[1]?.eventType, "PAYMENT_COMPLETED");
  });

  test("handles gateway failure and logs failure event", async () => {
    const auditRepo = new InMemoryAuditRepository();
    const auditService = new AuditService(auditRepo);
    const gateway = new RazorpayTestGateway();
    const paymentService = new PaymentService(gateway, auditService);

    const result = await paymentService.processPayment({
      transactionId: asTransactionId("tx_pay_fail"),
      warrantId: asWarrantId("w_pay_1"),
      merchantId: "freshmart",
      amount: { minorUnits: 999999, currency: "INR" }, // trigger test gateway failure
    });

    assert.equal(result.status, "FAILED");
    assert.ok(result.error?.includes("Simulated payment gateway failure"));

    const auditEvents = await auditService.query({ transactionId: asTransactionId("tx_pay_fail") });
    assert.equal(auditEvents.length, 2);
    assert.equal(auditEvents[1]?.eventType, "PAYMENT_FAILED");
  });
});
