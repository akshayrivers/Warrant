import type { MerchantId } from "../domain/types.js";

export type Category =
    | "groceries"
    | "electronics"
    | "subscriptions"
    | "pharmacy";

export enum MerchantStatus {
    AVAILABLE = "AVAILABLE",
    OFFLINE = "OFFLINE",
}

export interface Merchant {
    readonly merchantId: MerchantId;
    readonly name: string;
    readonly status: MerchantStatus;
}

export interface Product {
    readonly sku: string;
    readonly merchantId: MerchantId;
    readonly name: string;
    readonly description: string;
    readonly category: Category;

    /**
     * Price in the smallest currency unit.
     *
     * Example:
     * ₹299.00 -> 29900
     */
    readonly priceMinorUnits: number;

    readonly available: boolean;
}

export interface Catalog {
    readonly merchant: Merchant;
    readonly products: readonly Product[];
}