import "server-only";

import { collections } from "@/lib/db/collections";

// Sales per product for the products table (D-102): paid orders and revenue, never the $0 order of
// an order bump (its price is part of the main order). Only the session owner's store.

export type ProductSales = { orders: number; revenueCents: number };

export async function salesByProduct(storeId: string): Promise<Map<string, ProductSales>> {
  const { orders } = await collections();
  const rows = await orders
    .aggregate<{ _id: string; orders: number; revenueCents: number }>([
      { $match: { storeId, status: "paid", bumpOf: { $in: [null] } } },
      { $group: { _id: "$productId", orders: { $sum: 1 }, revenueCents: { $sum: "$totalCents" } } },
    ])
    .toArray();
  return new Map(rows.map((row) => [row._id, { orders: row.orders, revenueCents: row.revenueCents }]));
}
