import type { Money, TransactionId } from "../domain/types.js";

export interface CreateOrderParams {
  readonly amount: Money;
  readonly receipt: string; // usually transactionId
  readonly notes?: Record<string, string> | undefined;
}

export interface PaymentOrder {
  readonly orderId: string;
  readonly amountMinorUnits: number;
  readonly currency: string;
  readonly receipt: string;
  readonly status: "created" | "attempted" | "paid";
  readonly createdAt: string;
}

export interface ExecutePaymentParams {
  readonly transactionId: TransactionId;
  readonly orderId: string;
  readonly amount: Money;
  readonly merchantId: string;
  readonly idempotencyKey?: string | undefined;
}

export interface PaymentResult {
  readonly status: "SUCCESS" | "FAILED";
  readonly paymentId: string;
  readonly orderId: string;
  readonly amount: Money;
  readonly timestamp: string;
  readonly error?: string | undefined;
  readonly testMode: boolean;
}

export interface PaymentGateway {
  createOrder(params: CreateOrderParams): Promise<PaymentOrder>;
  executePayment(params: ExecutePaymentParams): Promise<PaymentResult>;
}
