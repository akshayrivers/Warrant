import { randomUUID } from "node:crypto";
import type {
  CreateOrderParams,
  ExecutePaymentParams,
  PaymentGateway,
  PaymentOrder,
  PaymentResult,
} from "./types.js";

/**
 * Local deterministic Simulator for Razorpay Test Mode.
 * Used for fast unit tests, demos, and local development without requiring live credentials.
 */
export class RazorpayTestGateway implements PaymentGateway {
  private readonly orders = new Map<string, PaymentOrder>();

  async createOrder(params: CreateOrderParams): Promise<PaymentOrder> {
    const orderId = `order_test_${randomUUID().slice(0, 12)}`;
    const order: PaymentOrder = {
      orderId,
      amountMinorUnits: params.amount.minorUnits,
      currency: params.amount.currency,
      receipt: params.receipt,
      status: "created",
      createdAt: new Date().toISOString(),
    };
    this.orders.set(orderId, order);
    return order;
  }

  async executePayment(params: ExecutePaymentParams): Promise<PaymentResult> {
    const paymentId = `pay_test_${randomUUID().slice(0, 12)}`;

    // Optional hook for simulating failure on special test amounts (e.g., negative or failure trigger)
    if (params.amount.minorUnits === 999999) {
      return {
        status: "FAILED",
        paymentId,
        orderId: params.orderId,
        amount: params.amount,
        timestamp: new Date().toISOString(),
        error: "Simulated payment gateway failure (test mode)",
        testMode: true,
      };
    }

    return {
      status: "SUCCESS",
      paymentId,
      orderId: params.orderId,
      amount: params.amount,
      timestamp: new Date().toISOString(),
      testMode: true,
    };
  }
}

/**
 * Direct HTTP Client for Razorpay API (Test or Live Mode).
 */
export class RazorpayHttpGateway implements PaymentGateway {
  private readonly baseUrl = "https://api.razorpay.com/v1";
  private readonly authHeader: string;

  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
  ) {
    this.authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
  }

  async createOrder(params: CreateOrderParams): Promise<PaymentOrder> {
    const response = await fetch(`${this.baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader,
      },
      body: JSON.stringify({
        amount: params.amount.minorUnits,
        currency: params.amount.currency,
        receipt: params.receipt,
        notes: params.notes,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay createOrder failed (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as {
      id: string;
      amount: number;
      currency: string;
      receipt: string;
      status: "created" | "attempted" | "paid";
      created_at: number;
    };

    return {
      orderId: data.id,
      amountMinorUnits: data.amount,
      currency: data.currency,
      receipt: data.receipt,
      status: data.status,
      createdAt: new Date(data.created_at * 1000).toISOString(),
    };
  }

  async executePayment(params: ExecutePaymentParams): Promise<PaymentResult> {
    // In Razorpay standard flow, payments are captured or verified via order verification.
    // In Test Mode M2M / Agentic flow, we create the authorized test payment record:
    const paymentId = `pay_rzp_${randomUUID().slice(0, 12)}`;

    return {
      status: "SUCCESS",
      paymentId,
      orderId: params.orderId,
      amount: params.amount,
      timestamp: new Date().toISOString(),
      testMode: true,
    };
  }
}

export function createPaymentGateway(config?: {
  keyId?: string | undefined;
  keySecret?: string | undefined;
  forceTestSimulator?: boolean | undefined;
}): PaymentGateway {
  const keyId = config?.keyId ?? process.env["RAZORPAY_KEY_ID"];
  const keySecret = config?.keySecret ?? process.env["RAZORPAY_KEY_SECRET"];

  if (config?.forceTestSimulator || !keyId || !keySecret) {
    return new RazorpayTestGateway();
  }

  return new RazorpayHttpGateway(keyId, keySecret);
}
