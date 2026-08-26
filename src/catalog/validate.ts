import type { MerchantId } from "../domain/types.js";
import type { Category, Product } from "./types.js";
import { getMerchant, getProduct } from "./catalog.js";

export interface TransactionProposal {
    readonly merchantId: MerchantId;
    readonly sku: string;
    readonly category: Category;
    readonly amountMinorUnits: number;
}

export type ProposalValidationReason =
    | "MERCHANT_NOT_FOUND"
    | "PRODUCT_NOT_FOUND"
    | "PRODUCT_UNAVAILABLE"
    | "MERCHANT_MISMATCH"
    | "CATEGORY_MISMATCH"
    | "PRICE_MISMATCH"
    | "INVALID_AMOUNT";

export type ProposalValidation =
    | {
        readonly valid: true;
        readonly product: Product;
    }
    | {
        readonly valid: false;
        readonly reason: ProposalValidationReason;
    };

export function validateProposal(
    proposal: TransactionProposal,
): ProposalValidation {
    /*
     * 1. Validate the amount before performing any catalog lookup.
     *
     * Money must always be represented as a positive integer number
     * of minor currency units.
     */
    if (
        !Number.isSafeInteger(proposal.amountMinorUnits) ||
        proposal.amountMinorUnits <= 0
    ) {
        return {
            valid: false,
            reason: "INVALID_AMOUNT",
        };
    }

    /*
     * 2. The merchant must actually exist.
     */
    const merchant = getMerchant(proposal.merchantId);

    if (!merchant) {
        return {
            valid: false,
            reason: "MERCHANT_NOT_FOUND",
        };
    }

    /*
     * 3. The SKU must actually exist.
     *
     * Notice that merchant ownership is checked separately below.
     */
    const product = getProduct(proposal.sku);

    if (!product) {
        return {
            valid: false,
            reason: "PRODUCT_NOT_FOUND",
        };
    }

    /*
     * 4. The SKU must belong to the merchant requested by the agent.
     *
     * This prevents an agent from taking a legitimate SKU from one
     * merchant and attaching another merchant to the transaction.
     */
    if (product.merchantId !== proposal.merchantId) {
        return {
            valid: false,
            reason: "MERCHANT_MISMATCH",
        };
    }

    /*
     * 5. The product must actually be available.
     */
    if (!product.available) {
        return {
            valid: false,
            reason: "PRODUCT_UNAVAILABLE",
        };
    }

    /*
     * 6. The category supplied by the agent must match the catalog.
     */
    if (product.category !== proposal.category) {
        return {
            valid: false,
            reason: "CATEGORY_MISMATCH",
        };
    }

    /*
     * 7. Most importantly, the amount supplied by the agent must
     * exactly match the authoritative catalog price.
     *
     * The LLM does NOT get to choose the price.
     */
    if (product.priceMinorUnits !== proposal.amountMinorUnits) {
        return {
            valid: false,
            reason: "PRICE_MISMATCH",
        };
    }

    return {
        valid: true,
        product,
    };
}