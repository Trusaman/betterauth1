"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { notifications } from "@/db/order-schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Create notification
export async function createNotification(
    userId: string,
    title: string,
    message: string,
    orderId?: string,
    type:
        | "order_status"
        | "comment"
        | "assignment"
        | "reminder" = "order_status"
) {
    try {
        await db.insert(notifications).values({
            userId,
            title,
            message,
            type,
            orderId,
        });
    } catch (error) {
        console.error("Error creating notification:", error);
    }
}

// Get notifications for current user
export async function getNotifications() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        const userNotifications = await db.query.notifications.findMany({
            where: eq(notifications.userId, session.user.id),
            orderBy: [desc(notifications.createdAt)],
            limit: 50,
        });

        const unreadCount = userNotifications.filter((n) => !n.isRead).length;

        return {
            success: true,
            notifications: userNotifications,
            unreadCount,
        };
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return { success: false, message: "Failed to fetch notifications" };
    }
}

// Mark notification as read
export async function markNotificationAsRead(notificationId: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        await db
            .update(notifications)
            .set({ isRead: true })
            .where(
                and(
                    eq(notifications.id, notificationId),
                    eq(notifications.userId, session.user.id)
                )
            );

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Error marking notification as read:", error);
        return {
            success: false,
            message: "Failed to mark notification as read",
        };
    }
}

// Mark all notifications as read
export async function markAllNotificationsAsRead() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        await db
            .update(notifications)
            .set({ isRead: true })
            .where(eq(notifications.userId, session.user.id));

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        return {
            success: false,
            message: "Failed to mark all notifications as read",
        };
    }
}

// Delete notification
export async function deleteNotification(notificationId: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        await db
            .delete(notifications)
            .where(
                and(
                    eq(notifications.id, notificationId),
                    eq(notifications.userId, session.user.id)
                )
            );

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Error deleting notification:", error);
        return { success: false, message: "Failed to delete notification" };
    }
}

// Clear all notifications
export async function clearAllNotifications() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return { success: false, message: "Not authenticated" };
        }

        await db
            .delete(notifications)
            .where(eq(notifications.userId, session.user.id));

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Error clearing all notifications:", error);
        return { success: false, message: "Failed to clear all notifications" };
    }
}
