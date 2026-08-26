import type { MerchantId } from "../domain/types.js";
import type { Catalog, Merchant, Product } from "./types.js";
import { MerchantStatus } from "./types.js";
import { asMerchantId } from "../domain/types.js";

const freshMart: Merchant = {
    merchantId: asMerchantId("freshmart"),
    name: "FreshMart",
    status: MerchantStatus.AVAILABLE,
};

const freshMartProducts: readonly Product[] = [
    {
        sku: "milk-2l",
        merchantId: freshMart.merchantId,
        name: "Fresh Milk 2L",
        description: "Two litre packet of fresh milk",
        category: "groceries",
        priceMinorUnits: 1284,
        available: true,
    },
    {
        sku: "bread-white",
        merchantId: freshMart.merchantId,
        name: "White Bread",
        description: "Freshly baked white bread",
        category: "groceries",
        priceMinorUnits: 450,
        available: true,
    },
    {
        sku: "eggs-12",
        merchantId: freshMart.merchantId,
        name: "Farm Eggs 12 Pack",
        description: "Pack of twelve farm fresh eggs",
        category: "groceries",
        priceMinorUnits: 720,
        available: true,
    },
    {
        sku: "premium-coffee",
        merchantId: freshMart.merchantId,
        name: "Premium Coffee",
        description: "Premium ground coffee",
        category: "groceries",
        priceMinorUnits: 899,
        available: false,
    },
];

const techMart: Merchant = {
    merchantId: asMerchantId("techmart"),
    name: "TechMart",
    status: MerchantStatus.AVAILABLE,
};

const techMartProducts: readonly Product[] = [
    {
        sku: "usb-c-cable",
        merchantId: techMart.merchantId,
        name: "USB-C Cable",
        description: "One metre USB-C charging cable",
        category: "electronics",
        priceMinorUnits: 599,
        available: true,
    },
];

export const catalogs: readonly Catalog[] = [
    {
        merchant: freshMart,
        products: freshMartProducts,
    },
    {
        merchant: techMart,
        products: techMartProducts,
    },
];

export function getCatalog(
    merchantId: MerchantId,
): Catalog | undefined {
    return catalogs.find(
        (catalog) => catalog.merchant.merchantId === merchantId,
    );
}

export function getMerchant(
    merchantId: MerchantId,
): Merchant | undefined {
    return catalogs.find(
        (catalog) => catalog.merchant.merchantId === merchantId,
    )?.merchant;
}

/**
 * Finds a product by SKU across the catalog.
 *
 * Merchant ownership is deliberately NOT part of this lookup.
 * validateProposal() performs that check separately.
 */
export function getProduct(
    sku: string,
): Product | undefined {
    for (const catalog of catalogs) {
        const product = catalog.products.find(
            (product) => product.sku === sku,
        );

        if (product) {
            return product;
        }
    }

    return undefined;
}