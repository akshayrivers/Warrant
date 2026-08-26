/**
 * Domain error classes for Warrant.
 *
 * Domain errors represent explicit failure conditions within the authorization,
 * proposal validation, or warrant lifecycle domains.
 */

export class WarrantError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = "WARRANT_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidWarrantError extends WarrantError {
  constructor(message: string = "The provided warrant is malformed or invalid") {
    super(message, "INVALID_WARRANT");
  }
}

export class ExpiredWarrantError extends WarrantError {
  constructor(message: string = "The provided warrant has expired") {
    super(message, "EXPIRED_WARRANT");
  }
}

export class SignatureVerificationError extends WarrantError {
  constructor(message: string = "Warrant cryptographic signature verification failed") {
    super(message, "INVALID_SIGNATURE");
  }
}

export class ProposalValidationError extends WarrantError {
  public readonly reason: string;

  constructor(reason: string, message?: string) {
    super(message ?? `Proposal validation failed: ${reason}`, "PROPOSAL_VALIDATION_FAILED");
    this.reason = reason;
  }
}

export class PolicyViolationError extends WarrantError {
  public readonly reason: string;

  constructor(reason: string, message?: string) {
    super(message ?? `Policy authorization blocked: ${reason}`, "POLICY_VIOLATION");
    this.reason = reason;
  }
}

export class DuplicateTransactionError extends WarrantError {
  public readonly transactionId: string;

  constructor(transactionId: string) {
    super(`Transaction ${transactionId} has already been processed`, "DUPLICATE_TRANSACTION");
    this.transactionId = transactionId;
  }
}

export class LimitExceededError extends WarrantError {
  constructor(message: string) {
    super(message, "LIMIT_EXCEEDED");
  }
}

export class MerchantNotFoundError extends WarrantError {
  constructor(merchantId: string) {
    super(`Merchant not found: ${merchantId}`, "MERCHANT_NOT_FOUND");
  }
}

export class ProductNotFoundError extends WarrantError {
  constructor(sku: string) {
    super(`Product SKU not found: ${sku}`, "PRODUCT_NOT_FOUND");
  }
}
