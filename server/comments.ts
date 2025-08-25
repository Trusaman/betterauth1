"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { orderComments, orders } from "@/db/order-schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { storeChangeHistory } from "@/lib/upstash";
import { createNotification } from "@/server/notifications";

// Get comments for an order
export async function getOrderComments(orderId: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        // Check if user has access to this order
        const order = await db.query.orders.findFirst({
            where: (orders, { eq }) => eq(orders.id, orderId),
        });

        if (!order) {
            return { success: false, message: "Order not found" };
        }

        // Get comments with user information
        const comments = await db.query.orderComments.findMany({
            where: (orderComments, { eq }) =>
                eq(orderComments.orderId, orderId),
            orderBy: (orderComments, { desc }) => [
                desc(orderComments.createdAt),
            ],
            with: {
                author: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
        });

        return { success: true, comments };
    } catch (error) {
        console.error("Error fetching comments:", error);
        return { success: false, message: "Failed to fetch comments" };
    }
}

// Add a new comment
export async function addOrderComment(
    orderId: string,
    content: string,
    parentCommentId?: string,
    isInternal: boolean = false
) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        // Check if user has access to this order
        const order = await db.query.orders.findFirst({
            where: (orders, { eq }) => eq(orders.id, orderId),
        });

        if (!order) {
            return { success: false, message: "Order not found" };
        }

        // Validate parent comment if provided
        if (parentCommentId) {
            const parentComment = await db.query.orderComments.findFirst({
                where: (orderComments, { eq, and }) =>
                    and(
                        eq(orderComments.id, parentCommentId),
                        eq(orderComments.orderId, orderId)
                    ),
            });

            if (!parentComment) {
                return { success: false, message: "Parent comment not found" };
            }
        }

        // Create the comment
        const [newComment] = await db
            .insert(orderComments)
            .values({
                orderId,
                authorId: session.user.id,
                content: content.trim(),
                parentCommentId: parentCommentId || null,
                isInternal,
            })
            .returning();

        // Store change history in Upstash
        await storeChangeHistory({
            entityType: "order",
            entityId: orderId,
            action: "comment_added",
            changes: {
                commentId: newComment.id,
                content: content.trim(),
                isInternal,
                parentCommentId: parentCommentId || null,
            },
            performedBy: session.user.id,
            metadata: {
                userRole: session.user.role,
                orderNumber: order.orderNumber,
                commentType: parentCommentId ? "reply" : "comment",
            },
        });

        // Notify relevant users about the new comment
        await notifyUsersAboutComment(
            order,
            newComment,
            session.user,
            isInternal
        );

        revalidatePath("/order");
        revalidatePath("/dashboard");

        return { success: true, comment: newComment };
    } catch (error) {
        console.error("Error adding comment:", error);
        return { success: false, message: "Failed to add comment" };
    }
}

// Update a comment
export async function updateOrderComment(commentId: string, content: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        // Get the comment
        const [comment] = await db
            .select()
            .from(orderComments)
            .where(eq(orderComments.id, commentId));

        if (!comment) {
            return { success: false, message: "Comment not found" };
        }

        // Check permissions
        if (
            comment.authorId !== session.user.id &&
            session.user.role !== "admin"
        ) {
            return { success: false, message: "Insufficient permissions" };
        }

        // Update the comment
        const [updatedComment] = await db
            .update(orderComments)
            .set({
                content: content.trim(),
                updatedAt: new Date(),
            })
            .where(eq(orderComments.id, commentId))
            .returning();

        // Store change history in Upstash
        await storeChangeHistory({
            entityType: "order",
            entityId: comment.orderId,
            action: "comment_updated",
            changes: {
                commentId,
                oldContent: comment.content,
                newContent: content.trim(),
            },
            performedBy: session.user.id,
            metadata: {
                userRole: session.user.role,
            },
        });

        revalidatePath("/order");
        revalidatePath("/dashboard");

        return { success: true, comment: updatedComment };
    } catch (error) {
        console.error("Error updating comment:", error);
        return { success: false, message: "Failed to update comment" };
    }
}

// Delete a comment
export async function deleteOrderComment(commentId: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        // Get the comment
        const [comment] = await db
            .select()
            .from(orderComments)
            .where(eq(orderComments.id, commentId));

        if (!comment) {
            return { success: false, message: "Comment not found" };
        }

        // Check permissions
        if (
            comment.authorId !== session.user.id &&
            session.user.role !== "admin"
        ) {
            return { success: false, message: "Insufficient permissions" };
        }

        // Delete the comment (this will cascade to replies)
        await db.delete(orderComments).where(eq(orderComments.id, commentId));

        // Store change history in Upstash
        await storeChangeHistory({
            entityType: "order",
            entityId: comment.orderId,
            action: "comment_deleted",
            changes: {
                commentId,
                deletedContent: comment.content,
            },
            performedBy: session.user.id,
            metadata: {
                userRole: session.user.role,
            },
        });

        revalidatePath("/order");
        revalidatePath("/dashboard");

        return { success: true };
    } catch (error) {
        console.error("Error deleting comment:", error);
        return { success: false, message: "Failed to delete comment" };
    }
}

// Helper function to notify users about new comments
async function notifyUsersAboutComment(
    order: any,
    comment: any,
    commenter: any,
    isInternal: boolean
) {
    try {
        // Don't notify about internal comments to non-staff users
        const staffRoles = ["admin", "accountant", "warehouse", "shipper"];

        // Notify order creator if not internal or if they're staff
        if (order.createdBy && order.createdBy !== commenter.id) {
            const [orderCreator] = await db.query.user.findMany({
                where: (user, { eq }) => eq(user.id, order.createdBy),
            });

            if (
                orderCreator &&
                (!isInternal || staffRoles.includes(orderCreator.role))
            ) {
                await createNotification(
                    order.createdBy,
                    "New Comment on Order",
                    `${commenter.name} added a ${
                        isInternal ? "internal " : ""
                    }comment on order ${order.orderNumber}`,
                    order.id
                );
            }
        }

        // Notify other users who have commented on this order
        const otherCommenters = await db.query.orderComments.findMany({
            where: (comments, { eq, and, ne }) =>
                and(
                    eq(comments.orderId, order.id),
                    ne(comments.authorId, commenter.id)
                ),
            with: {
                author: {
                    columns: {
                        id: true,
                        role: true,
                    },
                },
            },
        });

        const uniqueCommenters = new Set();
        for (const otherComment of otherCommenters) {
            if (!uniqueCommenters.has(otherComment.authorId)) {
                uniqueCommenters.add(otherComment.authorId);

                // Only notify if not internal or if they're staff
                if (
                    !isInternal ||
                    staffRoles.includes(otherComment.author.role)
                ) {
                    await createNotification(
                        otherComment.authorId,
                        "New Comment on Order",
                        `${commenter.name} added a ${
                            isInternal ? "internal " : ""
                        }comment on order ${order.orderNumber}`,
                        order.id
                    );
                }
            }
        }
    } catch (error) {
        console.error("Error sending comment notifications:", error);
    }
}
