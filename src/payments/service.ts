import type { AuditService } from "../audit/service.js";
import type { Money, TransactionId, WarrantId } from "../domain/types.js";
import type { PaymentGateway, PaymentResult } from "./types.js";

export interface ProcessPaymentParams {
  readonly transactionId: TransactionId;
  readonly warrantId: WarrantId;
  readonly merchantId: string;
  readonly amount: Money;
}

export class PaymentService {
  constructor(
    private readonly gateway: PaymentGateway,
    private readonly auditService: AuditService,
  ) {}

  async processPayment(params: ProcessPaymentParams): Promise<PaymentResult> {
    await this.auditService.logPaymentInitiated({
      transactionId: params.transactionId,
      warrantId: params.warrantId,
      merchantId: params.merchantId as any,
      amountMinorUnits: params.amount.minorUnits,
    });

    try {
      const order = await this.gateway.createOrder({
        amount: params.amount,
        receipt: params.transactionId,
        notes: {
          warrantId: params.warrantId,
          merchantId: params.merchantId,
        },
      });

      const result = await this.gateway.executePayment({
        transactionId: params.transactionId,
        orderId: order.orderId,
        amount: params.amount,
        merchantId: params.merchantId,
      });

      await this.auditService.logPaymentResult({
        transactionId: params.transactionId,
        status: result.status,
        paymentId: result.paymentId,
        orderId: result.orderId,
        amountMinorUnits: params.amount.minorUnits,
        error: result.error,
      });

      return result;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const failedResult: PaymentResult = {
        status: "FAILED",
        paymentId: "unknown",
        orderId: "unknown",
        amount: params.amount,
        timestamp: new Date().toISOString(),
        error: errorMsg,
        testMode: true,
      };

      await this.auditService.logPaymentResult({
        transactionId: params.transactionId,
        status: "FAILED",
        amountMinorUnits: params.amount.minorUnits,
        error: errorMsg,
      });

      return failedResult;
    }
  }
}
