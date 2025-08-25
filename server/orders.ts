"use server";

import { db } from "@/db/drizzle";
import {
    orders,
    orderItems,
    orderHistory,
    notifications,
} from "@/db/order-schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { storeChangeHistory } from "@/lib/upstash";
import { createNotification } from "@/server/notifications";
import { sendToUser, sendToRole, broadcast } from "@/app/api/sse/route";

// Type definitions
export type OrderStatus =
    | "pending"
    | "approved"
    | "edit_requested"
    | "rejected"
    | "warehouse_confirmed"
    | "warehouse_rejected"
    | "shipped"
    | "completed"
    | "partial_complete"
    | "failed"
    | "cancelled";

export type CreateOrderData = {
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    customerAddress?: string;
    items: {
        name: string;
        description?: string;
        sku?: string;
        price: number;
        quantity: number;
    }[];
};

// Generate unique order number
function generateOrderNumber(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `ORD-${timestamp}-${random}`;
}

// Create order history entry
async function createOrderHistory(
    orderId: string,
    action: string,
    performedBy: string,
    fromStatus?: string,
    toStatus?: string,
    reason?: string,
    notes?: string,
    fieldChanges?: Record<string, any>
) {
    await db.insert(orderHistory).values({
        orderId,
        action,
        fromStatus,
        toStatus,
        performedBy,
        reason,
        notes,
        fieldChanges: fieldChanges ? JSON.stringify(fieldChanges) : null,
    });
}

// Create new order (Sales role)
export async function createOrder(data: CreateOrderData) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        // Check permissions
        const { success: hasPermission } = await auth.api.userHasPermission({
            body: {
                userId: session.user.id,
                permissions: {
                    order: ["create"],
                },
            },
        });

        if (!hasPermission) {
            return { success: false, message: "Insufficient permissions" };
        }

        // Calculate total
        const total = data.items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        // Create order
        const [newOrder] = await db
            .insert(orders)
            .values({
                orderNumber: generateOrderNumber(),
                customerName: data.customerName,
                customerEmail: data.customerEmail,
                customerPhone: data.customerPhone,
                customerAddress: data.customerAddress,
                total: total.toString(),
                status: "pending",
                createdBy: session.user.id,
                updatedBy: session.user.id,
            })
            .returning();

        // Create order items
        await db.insert(orderItems).values(
            data.items.map((item) => ({
                orderId: newOrder.id,
                name: item.name,
                description: item.description,
                sku: item.sku,
                price: item.price.toString(),
                quantity: item.quantity,
            }))
        );

        // Create history entry
        await createOrderHistory(
            newOrder.id,
            "order_created",
            session.user.id,
            undefined,
            "pending",
            undefined,
            "Order created by sales team"
        );

        // Store change history in Upstash
        await storeChangeHistory({
            entityType: "order",
            entityId: newOrder.id,
            action: "order_created",
            changes: {
                orderNumber: newOrder.orderNumber,
                customerName: data.customerName,
                total: total,
                status: "pending",
                items: data.items,
            },
            performedBy: session.user.id,
            metadata: {
                userRole: session.user.role,
                itemCount: data.items.length,
            },
        });

        // Notify creator (sales) that order was created (visible in their NotificationCenter)
        try {
            const [creatorNotification] = await db
                .insert(notifications)
                .values({
                    userId: session.user.id,
                    title: "Order Created",
                    message: `Order ${newOrder.orderNumber} has been created and is pending approval`,
                    type: "order_status",
                    orderId: newOrder.id,
                })
                .returning();

            await sendToUser(session.user.id, {
                type: "new_notification",
                data: {
                    id: creatorNotification.id,
                    userId: creatorNotification.userId,
                    title: creatorNotification.title,
                    message: creatorNotification.message,
                    type: creatorNotification.type,
                    orderId: creatorNotification.orderId,
                    isRead: !!creatorNotification.isRead,
                    createdAt: creatorNotification.createdAt,
                },
                timestamp: new Date().toISOString(),
            });
        } catch (e) {
            console.warn("Failed to notify creator about order creation", e);
        }

        // Notify accountants about new order and send real-time events with proper IDs
        const accountants = await db.query.user.findMany({
            where: (user, { eq }) => eq(user.role, "accountant"),
        });

        // Create notifications in bulk and return inserted rows (guard empty)
        let insertedNotifications: any[] = [];
        if (accountants.length > 0) {
            insertedNotifications = await db
                .insert(notifications)
                .values(
                    accountants.map((accountant) => ({
                        userId: accountant.id,
                        title: "New Order Pending Approval",
                        message: `Order ${newOrder.orderNumber} from ${data.customerName} is pending your approval.`,
                        type: "order_status" as const,
                        orderId: newOrder.id,
                    }))
                )
                .returning();
        }

        // Send real-time update for order creation (role-based)
        try {
            await sendToRole("accountant", {
                type: "order_created",
                data: {
                    id: newOrder.id,
                    orderNumber: newOrder.orderNumber,
                    customerName: data.customerName,
                    total: total,
                    status: "pending",
                    createdBy: session.user.id,
                },
                timestamp: new Date().toISOString(),
            });

            // Send real-time notification events with IDs to each accountant
            for (const n of insertedNotifications) {
                await sendToUser(n.userId, {
                    type: "new_notification",
                    data: {
                        id: n.id,
                        userId: n.userId,
                        title: n.title,
                        message: n.message,
                        type: n.type,
                        orderId: n.orderId,
                        isRead: !!n.isRead,
                        createdAt: n.createdAt,
                    },
                    timestamp: new Date().toISOString(),
                });
            }
        } catch (error) {
            console.error(
                "Failed to send real-time update for order creation:",
                error
            );
        }

        revalidatePath("/dashboard");
        return {
            success: true,
            message: "Order created successfully",
            orderId: newOrder.id,
            orderNumber: newOrder.orderNumber,
        };
    } catch (error) {
        console.error("Error creating order:", error);
        return { success: false, message: "Failed to create order" };
    }
}

// Get orders for current user based on role
export async function getOrdersForUser() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        const userRole = session.user.role;
        let ordersList;

        switch (userRole) {
            case "sales":
                // Sales can see orders they created
                ordersList = await db.query.orders.findMany({
                    where: eq(orders.createdBy, session.user.id),
                    with: {
                        orderItems: true,
                    },
                    orderBy: desc(orders.createdAt),
                });
                break;

            case "accountant":
                // Accountants can see pending orders and orders they've processed
                ordersList = await db.query.orders.findMany({
                    where: (orders, { inArray }) =>
                        inArray(orders.status, [
                            "pending",
                            "approved",
                            "edit_requested",
                            "rejected",
                        ]),
                    with: {
                        orderItems: true,
                    },
                    orderBy: desc(orders.createdAt),
                });
                break;

            case "warehouse":
                // Warehouse can see approved orders
                ordersList = await db.query.orders.findMany({
                    where: (orders, { inArray }) =>
                        inArray(orders.status, [
                            "approved",
                            "warehouse_confirmed",
                            "warehouse_rejected",
                        ]),
                    with: {
                        orderItems: true,
                    },
                    orderBy: desc(orders.createdAt),
                });
                break;

            case "shipper":
                // Shippers can see warehouse confirmed orders
                ordersList = await db.query.orders.findMany({
                    where: (orders, { inArray }) =>
                        inArray(orders.status, [
                            "warehouse_confirmed",
                            "shipped",
                            "completed",
                            "partial_complete",
                            "failed",
                        ]),
                    with: {
                        orderItems: true,
                    },
                    orderBy: desc(orders.createdAt),
                });
                break;

            default:
                // Admin can see all orders
                ordersList = await db.query.orders.findMany({
                    with: {
                        orderItems: true,
                    },
                    orderBy: desc(orders.createdAt),
                });
        }

        return { success: true, orders: ordersList };
    } catch (error) {
        console.error("Error fetching orders:", error);
        return { success: false, message: "Failed to fetch orders" };
    }
}

// Approve order (Accountant role)
export async function approveOrder(orderId: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        // Check permissions
        const { success: hasPermission } = await auth.api.userHasPermission({
            body: {
                userId: session.user.id,
                permissions: {
                    order: ["approve"],
                },
            },
        });

        if (!hasPermission) {
            return { success: false, message: "Insufficient permissions" };
        }

        // Get current order
        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId));
        if (!order) {
            return { success: false, message: "Order not found" };
        }

        if (order.status !== "pending") {
            return {
                success: false,
                message: "Order is not in pending status",
            };
        }

        // Update order status
        await db
            .update(orders)
            .set({
                status: "approved",
                approvedBy: session.user.id,
                approvedAt: new Date(),
                updatedBy: session.user.id,
            })
            .where(eq(orders.id, orderId));

        // Create history entry
        await createOrderHistory(
            orderId,
            "status_changed",
            session.user.id,
            "pending",
            "approved",
            undefined,
            "Order approved by accountant"
        );

        // Store change history in Upstash
        await storeChangeHistory({
            entityType: "order",
            entityId: orderId,
            action: "order_approved",
            changes: {
                status: { from: "pending", to: "approved" },
                approvedBy: session.user.id,
                approvedAt: new Date().toISOString(),
            },
            performedBy: session.user.id,
            metadata: {
                userRole: session.user.role,
                orderNumber: order.orderNumber,
            },
        });

        // Notify warehouse team
        const warehouseUsers = await db.query.user.findMany({
            where: (user, { eq }) => eq(user.role, "warehouse"),
        });

        for (const warehouseUser of warehouseUsers) {
            await createNotification(
                warehouseUser.id,
                "Order Approved - Awaiting Confirmation",
                `Order ${order.orderNumber} has been approved and is awaiting warehouse confirmation.`,
                orderId
            );
        }

        // Notify order creator
        if (order.createdBy) {
            await createNotification(
                order.createdBy,
                "Order Approved",
                `Your order ${order.orderNumber} has been approved by the accountant.`,
                orderId
            );
        }

        // Send real-time update
        try {
            await sendToUser(order.createdBy!, {
                type: "order_status_changed",
                data: {
                    orderId,
                    newStatus: "approved",
                    orderNumber: order.orderNumber,
                },
                timestamp: new Date().toISOString(),
            });

            // Notify warehouse users about new approved order
            await sendToRole("warehouse", {
                type: "order_status_changed",
                data: {
                    orderId,
                    newStatus: "approved",
                    orderNumber: order.orderNumber,
                },
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error("Failed to send real-time update:", error);
        }

        revalidatePath("/dashboard");
        return { success: true, message: "Order approved successfully" };
    } catch (error) {
        console.error("Error approving order:", error);
        return { success: false, message: "Failed to approve order" };
    }
}

// Reject order (Accountant role)
export async function rejectOrder(orderId: string, reason: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        // Check permissions
        const { success: hasPermission } = await auth.api.userHasPermission({
            body: {
                userId: session.user.id,
                permissions: {
                    order: ["reject"],
                },
            },
        });

        if (!hasPermission) {
            return { success: false, message: "Insufficient permissions" };
        }

        // Get current order
        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId));
        if (!order) {
            return { success: false, message: "Order not found" };
        }

        if (order.status !== "pending") {
            return {
                success: false,
                message: "Order is not in pending status",
            };
        }

        // Update order status
        await db
            .update(orders)
            .set({
                status: "rejected",
                rejectionReason: reason,
                updatedBy: session.user.id,
            })
            .where(eq(orders.id, orderId));

        // Create history entry
        await createOrderHistory(
            orderId,
            "status_changed",
            session.user.id,
            "pending",
            "rejected",
            reason,
            "Order rejected by accountant"
        );

        // Notify order creator
        if (order.createdBy) {
            await createNotification(
                order.createdBy,
                "Order Rejected",
                `Your order ${order.orderNumber} has been rejected. Reason: ${reason}`,
                orderId
            );
        }

        revalidatePath("/dashboard");
        return { success: true, message: "Order rejected successfully" };
    } catch (error) {
        console.error("Error rejecting order:", error);
        return { success: false, message: "Failed to reject order" };
    }
}

// Warehouse confirm order (Warehouse role)
export async function warehouseConfirmOrder(orderId: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        // Check permissions
        const { success: hasPermission } = await auth.api.userHasPermission({
            body: {
                userId: session.user.id,
                permissions: {
                    order: ["confirm"],
                },
            },
        });

        if (!hasPermission) {
            return { success: false, message: "Insufficient permissions" };
        }

        // Get current order
        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId));
        if (!order) {
            return { success: false, message: "Order not found" };
        }

        if (order.status !== "approved") {
            return {
                success: false,
                message: "Order must be approved before warehouse confirmation",
            };
        }

        // Update order status
        await db
            .update(orders)
            .set({
                status: "warehouse_confirmed",
                warehouseConfirmedBy: session.user.id,
                warehouseConfirmedAt: new Date(),
                updatedBy: session.user.id,
            })
            .where(eq(orders.id, orderId));

        // Create history entry
        await createOrderHistory(
            orderId,
            "status_changed",
            session.user.id,
            "approved",
            "warehouse_confirmed",
            undefined,
            "Order confirmed by warehouse"
        );

        // Store change history in Upstash
        await storeChangeHistory({
            entityType: "order",
            entityId: orderId,
            action: "warehouse_confirmed",
            changes: {
                status: { from: "approved", to: "warehouse_confirmed" },
                warehouseConfirmedBy: session.user.id,
                warehouseConfirmedAt: new Date().toISOString(),
            },
            performedBy: session.user.id,
            metadata: {
                userRole: session.user.role,
                orderNumber: order.orderNumber,
            },
        });

        // Notify shippers about warehouse confirmed order
        const shippers = await db.query.user.findMany({
            where: (user, { eq }) => eq(user.role, "shipper"),
        });

        for (const shipper of shippers) {
            await createNotification(
                shipper.id,
                "Order Ready for Shipping",
                `Order ${order.orderNumber} has been confirmed by warehouse and is ready for shipping.`,
                orderId
            );
        }

        // Notify order creator
        if (order.createdBy) {
            await createNotification(
                order.createdBy,
                "Order Warehouse Confirmed",
                `Your order ${order.orderNumber} has been confirmed by the warehouse.`,
                orderId
            );
        }

        revalidatePath("/dashboard");
        return {
            success: true,
            message: "Order confirmed by warehouse successfully",
        };
    } catch (error) {
        console.error("Error confirming order:", error);
        return { success: false, message: "Failed to confirm order" };
    }
}

// Warehouse reject order (Warehouse role)
export async function warehouseRejectOrder(orderId: string, reason: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        // Check permissions
        const { success: hasPermission } = await auth.api.userHasPermission({
            body: {
                userId: session.user.id,
                permissions: {
                    order: ["reject"],
                },
            },
        });

        if (!hasPermission) {
            return { success: false, message: "Insufficient permissions" };
        }

        // Get current order
        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId));
        if (!order) {
            return { success: false, message: "Order not found" };
        }

        if (order.status !== "approved") {
            return {
                success: false,
                message:
                    "Order must be approved before warehouse can reject it",
            };
        }

        // Update order status
        await db
            .update(orders)
            .set({
                status: "warehouse_rejected",
                warehouseRejectionReason: reason,
                updatedBy: session.user.id,
            })
            .where(eq(orders.id, orderId));

        // Create history entry
        await createOrderHistory(
            orderId,
            "status_changed",
            session.user.id,
            "approved",
            "warehouse_rejected",
            reason,
            "Order rejected by warehouse"
        );

        // Store change history in Upstash
        await storeChangeHistory({
            entityType: "order",
            entityId: orderId,
            action: "warehouse_rejected",
            changes: {
                status: { from: "approved", to: "warehouse_rejected" },
                warehouseRejectionReason: reason,
            },
            performedBy: session.user.id,
            metadata: {
                userRole: session.user.role,
                orderNumber: order.orderNumber,
            },
        });

        // Notify order creator
        if (order.createdBy) {
            await createNotification(
                order.createdBy,
                "Order Rejected by Warehouse",
                `Your order ${order.orderNumber} has been rejected by warehouse. Reason: ${reason}`,
                orderId
            );
        }

        // Notify accountant
        if (order.approvedBy) {
            await createNotification(
                order.approvedBy,
                "Order Rejected by Warehouse",
                `Order ${order.orderNumber} that you approved has been rejected by warehouse. Reason: ${reason}`,
                orderId
            );
        }

        revalidatePath("/dashboard");
        return {
            success: true,
            message: "Order rejected by warehouse successfully",
        };
    } catch (error) {
        console.error("Error rejecting order:", error);
        return { success: false, message: "Failed to reject order" };
    }
}

// Ship order (Shipper role)
export async function shipOrder(
    orderId: string,
    trackingNumber?: string,
    shippingNotes?: string
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        // Check permissions
        const { success: hasPermission } = await auth.api.userHasPermission({
            body: {
                userId: session.user.id,
                permissions: {
                    order: ["ship"],
                },
            },
        });

        if (!hasPermission) {
            return { success: false, message: "Insufficient permissions" };
        }

        // Get current order
        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId));
        if (!order) {
            return { success: false, message: "Order not found" };
        }

        if (order.status !== "warehouse_confirmed") {
            return {
                success: false,
                message: "Order must be warehouse confirmed before shipping",
            };
        }

        // Update order status
        await db
            .update(orders)
            .set({
                status: "shipped",
                shippedBy: session.user.id,
                shippedAt: new Date(),
                trackingNumber: trackingNumber || null,
                shippingNotes: shippingNotes || null,
                updatedBy: session.user.id,
            })
            .where(eq(orders.id, orderId));

        // Create history entry
        await createOrderHistory(
            orderId,
            "status_changed",
            session.user.id,
            "warehouse_confirmed",
            "shipped",
            undefined,
            `Order shipped by shipper${
                trackingNumber ? ` with tracking: ${trackingNumber}` : ""
            }`
        );

        // Store change history in Upstash
        await storeChangeHistory({
            entityType: "order",
            entityId: orderId,
            action: "order_shipped",
            changes: {
                status: { from: "warehouse_confirmed", to: "shipped" },
                shippedBy: session.user.id,
                shippedAt: new Date().toISOString(),
                trackingNumber: trackingNumber || null,
                shippingNotes: shippingNotes || null,
            },
            performedBy: session.user.id,
            metadata: {
                userRole: session.user.role,
                orderNumber: order.orderNumber,
            },
        });

        // Notify order creator
        if (order.createdBy) {
            await createNotification(
                order.createdBy,
                "Order Shipped",
                `Your order ${order.orderNumber} has been shipped${
                    trackingNumber
                        ? ` with tracking number: ${trackingNumber}`
                        : ""
                }.`,
                orderId
            );
        }

        revalidatePath("/dashboard");
        return {
            success: true,
            message: "Order shipped successfully",
        };
    } catch (error) {
        console.error("Error shipping order:", error);
        return { success: false, message: "Failed to ship order" };
    }
}

// Complete order (Shipper role)
export async function completeOrder(orderId: string, completionNotes?: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        // Check permissions
        const { success: hasPermission } = await auth.api.userHasPermission({
            body: {
                userId: session.user.id,
                permissions: {
                    order: ["update"],
                },
            },
        });

        if (!hasPermission) {
            return { success: false, message: "Insufficient permissions" };
        }

        // Get current order
        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId));
        if (!order) {
            return { success: false, message: "Order not found" };
        }

        if (order.status !== "shipped") {
            return {
                success: false,
                message: "Order must be shipped before completion",
            };
        }

        // Update order status
        await db
            .update(orders)
            .set({
                status: "completed",
                completedAt: new Date(),
                completionNotes: completionNotes || null,
                updatedBy: session.user.id,
            })
            .where(eq(orders.id, orderId));

        // Create history entry
        await createOrderHistory(
            orderId,
            "status_changed",
            session.user.id,
            "shipped",
            "completed",
            undefined,
            `Order completed by shipper${
                completionNotes ? `: ${completionNotes}` : ""
            }`
        );

        // Store change history in Upstash
        await storeChangeHistory({
            entityType: "order",
            entityId: orderId,
            action: "order_completed",
            changes: {
                status: { from: "shipped", to: "completed" },
                completedAt: new Date().toISOString(),
                completionNotes: completionNotes || null,
            },
            performedBy: session.user.id,
            metadata: {
                userRole: session.user.role,
                orderNumber: order.orderNumber,
            },
        });

        // Notify order creator
        if (order.createdBy) {
            await createNotification(
                order.createdBy,
                "Order Completed",
                `Your order ${
                    order.orderNumber
                } has been completed successfully${
                    completionNotes ? `. Notes: ${completionNotes}` : ""
                }.`,
                orderId
            );
        }

        // Notify admins about completion (bulk insert + SSE)
        try {
            const admins = await db.query.user.findMany({
                where: (user, { eq }) => eq(user.role, "admin"),
            });

            if (admins.length > 0) {
                const adminNotifs = await db
                    .insert(notifications)
                    .values(
                        admins.map((admin) => ({
                            userId: admin.id,
                            title: "Order Completed",
                            message: `Order ${order.orderNumber} has been marked as completed`,
                            type: "order_status" as const,
                            orderId,
                        }))
                    )
                    .returning();

                for (const n of adminNotifs) {
                    await sendToUser(n.userId, {
                        type: "new_notification",
                        data: {
                            id: n.id,
                            userId: n.userId,
                            title: n.title,
                            message: n.message,
                            type: n.type,
                            orderId: n.orderId,
                            isRead: !!n.isRead,
                            createdAt: n.createdAt,
                        },
                        timestamp: new Date().toISOString(),
                    });
                }
            }
        } catch (e) {
            console.warn("Failed to notify admins about completion", e);
        }

        revalidatePath("/dashboard");
        return {
            success: true,
            message: "Order completed successfully",
        };
    } catch (error) {
        console.error("Error completing order:", error);
        return { success: false, message: "Failed to complete order" };
    }
}

// Mark order as failed (Shipper role)
export async function failOrder(orderId: string, reason: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        // Check permissions
        const { success: hasPermission } = await auth.api.userHasPermission({
            body: {
                userId: session.user.id,
                permissions: {
                    order: ["update"],
                },
            },
        });

        if (!hasPermission) {
            return { success: false, message: "Insufficient permissions" };
        }

        // Get current order
        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId));
        if (!order) {
            return { success: false, message: "Order not found" };
        }

        if (order.status !== "shipped") {
            return {
                success: false,
                message: "Order must be shipped before marking as failed",
            };
        }

        // Update order status
        await db
            .update(orders)
            .set({
                status: "failed",
                completionNotes: reason,
                updatedBy: session.user.id,
            })
            .where(eq(orders.id, orderId));

        // Create history entry
        await createOrderHistory(
            orderId,
            "status_changed",
            session.user.id,
            "shipped",
            "failed",
            reason,
            "Order marked as failed by shipper"
        );

        // Store change history in Upstash
        await storeChangeHistory({
            entityType: "order",
            entityId: orderId,
            action: "order_failed",
            changes: {
                status: { from: "shipped", to: "failed" },
                completionNotes: reason,
            },
            performedBy: session.user.id,
            metadata: {
                userRole: session.user.role,
                orderNumber: order.orderNumber,
            },
        });

        // Notify order creator
        if (order.createdBy) {
            await createNotification(
                order.createdBy,
                "Order Failed",
                `Your order ${order.orderNumber} has failed during delivery. Reason: ${reason}`,
                orderId
            );
        }

        // Notify warehouse
        if (order.warehouseConfirmedBy) {
            await createNotification(
                order.warehouseConfirmedBy,
                "Order Delivery Failed",
                `Order ${order.orderNumber} that you confirmed has failed during delivery. Reason: ${reason}`,
                orderId
            );
        }

        revalidatePath("/dashboard");
        return {
            success: true,
            message: "Order marked as failed successfully",
        };
    } catch (error) {
        console.error("Error marking order as failed:", error);
        return { success: false, message: "Failed to mark order as failed" };
    }
}

// Partial complete order (Shipper role)
export async function partialCompleteOrder(orderId: string, notes?: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) return { success: false, message: "Not authenticated" };

        const { success: hasPermission } = await auth.api.userHasPermission({
            body: {
                userId: session.user.id,
                permissions: { order: ["update"] },
            },
        });
        if (!hasPermission)
            return { success: false, message: "Insufficient permissions" };

        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId));
        if (!order) return { success: false, message: "Order not found" };

        if (order.status !== "shipped") {
            return {
                success: false,
                message:
                    "Order must be shipped before marking as partial complete",
            };
        }

        await db
            .update(orders)
            .set({
                status: "partial_complete",
                completionNotes: notes || null,
                updatedBy: session.user.id,
            })
            .where(eq(orders.id, orderId));

        await createOrderHistory(
            orderId,
            "status_changed",
            session.user.id,
            "shipped",
            "partial_complete",
            notes,
            `Order partially completed by shipper${notes ? `: ${notes}` : ""}`
        );

        await storeChangeHistory({
            entityType: "order",
            entityId: orderId,
            action: "order_partial_completed",
            changes: {
                status: { from: "shipped", to: "partial_complete" },
                completionNotes: notes || null,
            },
            performedBy: session.user.id,
            metadata: {
                userRole: session.user.role,
                orderNumber: order.orderNumber,
            },
        });

        // Notify order creator
        if (order.createdBy) {
            await db.insert(notifications).values({
                userId: order.createdBy,
                title: "Order Partially Completed",
                message: `Your order ${
                    order.orderNumber
                } has been partially completed${
                    notes ? `. Notes: ${notes}` : ""
                }.`,
                type: "order_status",
                orderId,
            });
        }

        // Notify admins
        try {
            const admins = await db.query.user.findMany({
                where: (user, { eq }) => eq(user.role, "admin"),
            });
            if (admins.length > 0) {
                const adminNotifs = await db
                    .insert(notifications)
                    .values(
                        admins.map((admin) => ({
                            userId: admin.id,
                            title: "Order Partially Completed",
                            message: `Order ${order.orderNumber} has been marked as partially completed`,
                            type: "order_status" as const,
                            orderId,
                        }))
                    )
                    .returning();

                for (const n of adminNotifs) {
                    await sendToUser(n.userId, {
                        type: "new_notification",
                        data: {
                            id: n.id,
                            userId: n.userId,
                            title: n.title,
                            message: n.message,
                            type: n.type,
                            orderId: n.orderId,
                            isRead: !!n.isRead,
                            createdAt: n.createdAt,
                        },
                        timestamp: new Date().toISOString(),
                    });
                }
            }
        } catch (e) {
            console.warn("Failed to notify admins about partial completion", e);
        }

        revalidatePath("/dashboard");
        return {
            success: true,
            message: "Order marked as partially completed",
        };
    } catch (error) {
        console.error("Error marking order as partially completed:", error);
        return {
            success: false,
            message: "Failed to mark order as partially completed",
        };
    }
}

// Cancel order (Admin/Accountant role)
export async function cancelOrder(orderId: string, reason?: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) return { success: false, message: "Not authenticated" };

        const { success: hasPermission } = await auth.api.userHasPermission({
            body: {
                userId: session.user.id,
                permissions: { order: ["update"] },
            },
        });
        if (!hasPermission)
            return { success: false, message: "Insufficient permissions" };

        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId));
        if (!order) return { success: false, message: "Order not found" };

        if (["completed", "failed", "cancelled"].includes(order.status)) {
            return {
                success: false,
                message: `Cannot cancel an order in status '${order.status}'`,
            };
        }

        await db
            .update(orders)
            .set({
                status: "cancelled",
                cancellationReason: reason || null,
                updatedBy: session.user.id,
            })
            .where(eq(orders.id, orderId));

        await createOrderHistory(
            orderId,
            "status_changed",
            session.user.id,
            order.status,
            "cancelled",
            reason,
            `Order cancelled${reason ? `: ${reason}` : ""}`
        );

        await storeChangeHistory({
            entityType: "order",
            entityId: orderId,
            action: "order_cancelled",
            changes: {
                status: { from: order.status, to: "cancelled" },
                reason: reason || null,
            },
            performedBy: session.user.id,
            metadata: {
                userRole: session.user.role,
                orderNumber: order.orderNumber,
            },
        });

        // Notify order creator
        if (order.createdBy) {
            await db.insert(notifications).values({
                userId: order.createdBy,
                title: "Order Cancelled",
                message: `Your order ${order.orderNumber} has been cancelled${
                    reason ? `. Reason: ${reason}` : ""
                }.`,
                type: "order_status",
                orderId,
            });
        }

        // Notify admins
        try {
            const admins = await db.query.user.findMany({
                where: (user, { eq }) => eq(user.role, "admin"),
            });
            if (admins.length > 0) {
                const adminNotifs = await db
                    .insert(notifications)
                    .values(
                        admins.map((admin) => ({
                            userId: admin.id,
                            title: "Order Cancelled",
                            message: `Order ${
                                order.orderNumber
                            } has been cancelled${reason ? `: ${reason}` : ""}`,
                            type: "order_status" as const,
                            orderId,
                        }))
                    )
                    .returning();

                for (const n of adminNotifs) {
                    await sendToUser(n.userId, {
                        type: "new_notification",
                        data: {
                            id: n.id,
                            userId: n.userId,
                            title: n.title,
                            message: n.message,
                            type: n.type,
                            orderId: n.orderId,
                            isRead: !!n.isRead,
                            createdAt: n.createdAt,
                        },
                        timestamp: new Date().toISOString(),
                    });
                }
            }
        } catch (e) {
            console.warn("Failed to notify admins about cancellation", e);
        }

        revalidatePath("/dashboard");
        return { success: true, message: "Order cancelled successfully" };
    } catch (error) {
        console.error("Error cancelling order:", error);
        return { success: false, message: "Failed to cancel order" };
    }
}

// Get dashboard metrics for role-specific dashboards
export async function getDashboardMetrics() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        const userRole = session.user.role;
        const userId = session.user.id;

        // Base metrics for all roles
        const allOrders = await db.query.orders.findMany({
            with: {
                orderItems: true,
            },
        });

        const totalOrders = allOrders.length;
        const pendingOrders = allOrders.filter(
            (o) => o.status === "pending"
        ).length;
        const approvedOrders = allOrders.filter(
            (o) => o.status === "approved"
        ).length;
        const rejectedOrders = allOrders.filter(
            (o) => o.status === "rejected"
        ).length;
        const completedOrders = allOrders.filter(
            (o) => o.status === "completed"
        ).length;

        const totalRevenue = allOrders
            .filter((o) => o.status === "completed")
            .reduce((sum, order) => sum + parseFloat(order.total), 0);

        const averageOrderValue =
            completedOrders > 0 ? totalRevenue / completedOrders : 0;

        // Role-specific metrics
        let roleSpecificMetrics = {};
        let priorityOrders: any[] = [];

        // Common date calculation for monthly metrics
        const thisMonth = new Date();
        thisMonth.setDate(1);

        switch (userRole) {
            case "sales":
                const myOrders = allOrders.filter(
                    (o) => o.createdBy === userId
                );

                const monthlyOrders = myOrders.filter(
                    (o) => new Date(o.createdAt) >= thisMonth
                );

                const monthlyRevenue = monthlyOrders
                    .filter((o) => o.status === "completed")
                    .reduce((sum, order) => sum + parseFloat(order.total), 0);

                const conversionRate =
                    myOrders.length > 0
                        ? (myOrders.filter((o) => o.status !== "rejected")
                              .length /
                              myOrders.length) *
                          100
                        : 0;

                roleSpecificMetrics = {
                    myOrders: myOrders.length,
                    monthlyOrders: monthlyOrders.length,
                    monthlyRevenue: monthlyRevenue.toFixed(2),
                    conversionRate: conversionRate.toFixed(1),
                };

                priorityOrders = myOrders
                    .filter((o) => o.status === "pending")
                    .slice(0, 5);
                break;

            case "accountant":
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const approvedToday = allOrders.filter(
                    (o) =>
                        o.status === "approved" &&
                        o.approvedAt &&
                        new Date(o.approvedAt) >= today
                ).length;

                const pendingValue = allOrders
                    .filter((o) => o.status === "pending")
                    .reduce((sum, order) => sum + parseFloat(order.total), 0);

                const totalReviewed = allOrders.filter(
                    (o) => o.status === "approved" || o.status === "rejected"
                ).length;

                const approvalRate =
                    totalReviewed > 0
                        ? (approvedOrders / totalReviewed) * 100
                        : 0;

                roleSpecificMetrics = {
                    approvedToday,
                    pendingValue: pendingValue.toFixed(2),
                    approvalRate: approvalRate.toFixed(1),
                };

                priorityOrders = allOrders
                    .filter((o) => o.status === "pending")
                    .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
                    .slice(0, 5);
                break;

            case "warehouse":
                const readyToShip = allOrders.filter(
                    (o) => o.status === "approved"
                ).length;

                const confirmedToday = allOrders.filter(
                    (o) =>
                        o.status === "warehouse_confirmed" &&
                        o.warehouseConfirmedAt &&
                        new Date(o.warehouseConfirmedAt) >= today
                ).length;

                // Mock inventory alerts - in real app, this would come from inventory system
                const inventoryAlerts = 3;

                // Calculate average processing time (mock data)
                const avgProcessingTime = 2.5;

                roleSpecificMetrics = {
                    readyToShip,
                    confirmedToday,
                    inventoryAlerts,
                    avgProcessingTime,
                };

                priorityOrders = allOrders
                    .filter((o) => o.status === "approved")
                    .slice(0, 5);
                break;

            case "shipper":
                const readyToShipShipper = allOrders.filter(
                    (o) => o.status === "warehouse_confirmed"
                ).length;
                const inTransit = allOrders.filter(
                    (o) => o.status === "shipped"
                ).length;

                const deliveredToday = allOrders.filter(
                    (o) =>
                        o.status === "completed" &&
                        o.completedAt &&
                        new Date(o.completedAt) >= today
                ).length;

                const totalShipped = allOrders.filter(
                    (o) => o.status === "completed" || o.status === "failed"
                ).length;

                const deliveryRate =
                    totalShipped > 0
                        ? (completedOrders / totalShipped) * 100
                        : 0;

                roleSpecificMetrics = {
                    readyToShip: readyToShipShipper,
                    inTransit,
                    deliveredToday,
                    deliveryRate: deliveryRate.toFixed(1),
                };

                priorityOrders = allOrders
                    .filter(
                        (o) =>
                            o.status === "warehouse_confirmed" ||
                            o.status === "shipped"
                    )
                    .slice(0, 5);
                break;

            default: // admin
                const activeUsers = 25; // Mock data
                roleSpecificMetrics = {
                    activeUsers,
                    monthlyOrders: allOrders.filter(
                        (o) => new Date(o.createdAt) >= thisMonth
                    ).length,
                };

                priorityOrders = allOrders
                    .filter((o) =>
                        ["pending", "approved", "warehouse_confirmed"].includes(
                            o.status
                        )
                    )
                    .slice(0, 5);
                break;
        }

        // Get recent activity from order history
        const recentActivity = await db.query.orderHistory.findMany({
            limit: 10,
            orderBy: (history, { desc }) => [desc(history.createdAt)],
            with: {
                order: {
                    columns: {
                        orderNumber: true,
                    },
                },
                performedByUser: {
                    columns: {
                        name: true,
                    },
                },
            },
        });

        const formattedActivity = recentActivity.map((activity) => ({
            id: activity.id,
            type: activity.action,
            description: `${
                activity.performedByUser?.name || "Unknown"
            } ${activity.action.replace("_", " ")} order ${
                activity.order?.orderNumber
            }`,
            timestamp: activity.createdAt.toISOString(),
            orderId: activity.orderId,
            orderNumber: activity.order?.orderNumber,
        }));

        return {
            success: true,
            metrics: {
                totalOrders,
                pendingOrders,
                approvedOrders,
                rejectedOrders,
                completedOrders,
                totalRevenue: totalRevenue.toFixed(2),
                averageOrderValue: averageOrderValue.toFixed(2),
                recentActivity: formattedActivity,
                roleSpecificMetrics,
            },
            priorityOrders: priorityOrders.map((order) => ({
                id: order.id,
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                total: order.total,
                status: order.status,
                createdAt: order.createdAt.toISOString(),
                urgency:
                    parseFloat(order.total) > 1000
                        ? "high"
                        : parseFloat(order.total) > 500
                        ? "medium"
                        : "low",
            })),
        };
    } catch (error) {
        console.error("Error fetching dashboard metrics:", error);
        return { success: false, message: "Failed to fetch dashboard metrics" };
    }
}

// Get order by ID with full details
export async function getOrderById(orderId: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        const order = await db.query.orders.findFirst({
            where: eq(orders.id, orderId),
            with: {
                orderItems: true,
                createdByUser: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
                approvedByUser: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
        });

        if (!order) {
            return { success: false, message: "Order not found" };
        }

        return { success: true, order };
    } catch (error) {
        console.error("Error fetching order:", error);
        return { success: false, message: "Failed to fetch order" };
    }
}

// Get order history with user details
export async function getOrderHistory(orderId: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        const history = await db.query.orderHistory.findMany({
            where: eq(orderHistory.orderId, orderId),
            orderBy: [desc(orderHistory.createdAt)],
            with: {
                performedByUser: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
        });

        return { success: true, history };
    } catch (error) {
        console.error("Error fetching order history:", error);
        return { success: false, message: "Failed to fetch order history" };
    }
}
