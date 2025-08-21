"use server";

import { db } from "@/db/drizzle";
import { orders, orderItems } from "@/db/order-schema";
import { canCreateOrder } from "@/server/has-permissions";
import { eq, desc } from "drizzle-orm";

export interface CreateOrderData {
    customerName: string;
    items: {
        name: string;
        price: number;
        quantity: number;
    }[];
    userId?: string;
}

export async function createOrder(data: CreateOrderData) {
    const canCreate = await canCreateOrder();

    if (!canCreate) {
        throw new Error("You don't have permission to create an order");
    }

    const total = data.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    const [order] = await db
        .insert(orders)
        .values({
            customerName: data.customerName,
            total: total.toString(),
            userId: data.userId,
        })
        .returning();

    await db.insert(orderItems).values(
        data.items.map((item) => ({
            orderId: order.id,
            name: item.name,
            price: item.price.toString(),
            quantity: item.quantity,
        }))
    );

    return order;
}

export async function getOrders(userId?: string) {
    const query = db
        .select({
            id: orders.id,
            customerName: orders.customerName,
            total: orders.total,
            status: orders.status,
            createdAt: orders.createdAt,
            items: {
                id: orderItems.id,
                name: orderItems.name,
                price: orderItems.price,
                quantity: orderItems.quantity,
            },
        })
        .from(orders)
        .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
        .orderBy(desc(orders.createdAt));

    if (userId) {
        query.where(eq(orders.userId, userId));
    }

    return await query;
}

export async function updateOrderStatus(
    orderId: string,
    status: "pending" | "processing" | "completed" | "cancelled"
) {
    const [updatedOrder] = await db
        .update(orders)
        .set({
            status,
            updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

    return updatedOrder;
}
