import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { asMerchantId } from "../domain/types.js";
import {
    validateProposal,
    type TransactionProposal,
} from "./validate.js";

const FRESH_MART = asMerchantId("freshmart");
const TECH_MART = asMerchantId("techmart");

function baseProposal(
    overrides: Partial<TransactionProposal> = {},
): TransactionProposal {
    return {
        merchantId: FRESH_MART,
        sku: "milk-2l",
        category: "groceries",
        amountMinorUnits: 1284,
        ...overrides,
    };
}

describe("Catalog proposal validation", () => {
    test("accepts a valid product proposal", () => {
        const result = validateProposal(baseProposal());

        assert.equal(result.valid, true);

        if (result.valid) {
            assert.equal(result.product.sku, "milk-2l");
            assert.equal(result.product.merchantId, FRESH_MART);
            assert.equal(result.product.priceMinorUnits, 1284);
        }
    });

    test("rejects an unknown product SKU", () => {
        const result = validateProposal(
            baseProposal({
                sku: "non-existent-product",
            }),
        );

        assert.deepEqual(result, {
            valid: false,
            reason: "PRODUCT_NOT_FOUND",
        });
    });

    test("rejects an unavailable product", () => {
        const result = validateProposal(
            baseProposal({
                sku: "premium-coffee",
                amountMinorUnits: 899,
            }),
        );

        assert.deepEqual(result, {
            valid: false,
            reason: "PRODUCT_UNAVAILABLE",
        });
    });

    test("rejects a merchant mismatch", () => {
        const result = validateProposal(
            baseProposal({
                merchantId: TECH_MART,
                sku: "milk-2l",
            }),
        );

        assert.deepEqual(result, {
            valid: false,
            reason: "MERCHANT_MISMATCH",
        });
    });

    test("rejects an unknown merchant", () => {
        const result = validateProposal(
            baseProposal({
                merchantId: asMerchantId("unknown-merchant"),
            }),
        );

        assert.deepEqual(result, {
            valid: false,
            reason: "MERCHANT_NOT_FOUND",
        });
    });

    test("rejects a category mismatch", () => {
        const result = validateProposal(
            baseProposal({
                category: "electronics",
            }),
        );

        assert.deepEqual(result, {
            valid: false,
            reason: "CATEGORY_MISMATCH",
        });
    });

    test("rejects a price mismatch", () => {
        const result = validateProposal(
            baseProposal({
                amountMinorUnits: 9999,
            }),
        );

        assert.deepEqual(result, {
            valid: false,
            reason: "PRICE_MISMATCH",
        });
    });

    test("rejects zero amount", () => {
        const result = validateProposal(
            baseProposal({
                amountMinorUnits: 0,
            }),
        );

        assert.deepEqual(result, {
            valid: false,
            reason: "INVALID_AMOUNT",
        });
    });

    test("rejects negative amount", () => {
        const result = validateProposal(
            baseProposal({
                amountMinorUnits: -100,
            }),
        );

        assert.deepEqual(result, {
            valid: false,
            reason: "INVALID_AMOUNT",
        });
    });

    test("rejects non-integer amount", () => {
        const result = validateProposal(
            baseProposal({
                amountMinorUnits: 1284.5,
            }),
        );

        assert.deepEqual(result, {
            valid: false,
            reason: "INVALID_AMOUNT",
        });
    });
});