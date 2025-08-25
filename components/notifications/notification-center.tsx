"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Bell,
    BellRing,
    X,
    Check,
    CheckCheck,
    Trash2,
    Package,
    MessageSquare,
    UserCheck,
    Clock,
    ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// Proper TypeScript interfaces
interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: "order_status" | "comment" | "assignment" | "reminder";
    orderId?: string;
    commentId?: string;
    isRead: boolean;
    readAt?: Date | null;
    metadata?: string;
    createdAt: Date;
}

interface NotificationCenterProps {
    notifications: Notification[];
    unreadCount: number;
    onMarkAsRead: (
        notificationId: string
    ) => Promise<{ success: boolean; message?: string }>;
    onMarkAllAsRead: () => Promise<{ success: boolean; message?: string }>;
    onDeleteNotification: (
        notificationId: string
    ) => Promise<{ success: boolean; message?: string }>;
    onClearAll: () => Promise<{ success: boolean; message?: string }>;
    onNavigateToOrder?: (orderId: string) => void;
}

const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
        case "order_status":
            return <Package className="w-4 h-4 text-blue-500" />;
        case "comment":
            return <MessageSquare className="w-4 h-4 text-green-500" />;
        case "assignment":
            return <UserCheck className="w-4 h-4 text-purple-500" />;
        case "reminder":
            return <Clock className="w-4 h-4 text-orange-500" />;
        default:
            return <Bell className="w-4 h-4 text-gray-500" />;
    }
};

export function NotificationCenter({
    notifications,
    unreadCount,
    onMarkAsRead,
    onMarkAllAsRead,
    onDeleteNotification,
    onClearAll,
    onNavigateToOrder,
}: NotificationCenterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loadingActions, setLoadingActions] = useState<Set<string>>(
        new Set()
    );

    const handleMarkAsRead = async (notificationId: string) => {
        if (loadingActions.has(notificationId)) return;

        setLoadingActions((prev) => new Set(prev).add(notificationId));
        try {
            const result = await onMarkAsRead(notificationId);
            if (result.success) {
                toast.success("Notification marked as read");
            } else {
                toast.error(
                    result.message || "Failed to mark notification as read"
                );
            }
        } catch (error) {
            toast.error("Failed to mark notification as read");
        } finally {
            setLoadingActions((prev) => {
                const newSet = new Set(prev);
                newSet.delete(notificationId);
                return newSet;
            });
        }
    };

    const handleMarkAllAsRead = async () => {
        if (loadingActions.has("mark-all")) return;

        setLoadingActions((prev) => new Set(prev).add("mark-all"));
        try {
            const result = await onMarkAllAsRead();
            if (result.success) {
                toast.success("All notifications marked as read");
            } else {
                toast.error(
                    result.message || "Failed to mark all notifications as read"
                );
            }
        } catch (error) {
            toast.error("Failed to mark all notifications as read");
        } finally {
            setLoadingActions((prev) => {
                const newSet = new Set(prev);
                newSet.delete("mark-all");
                return newSet;
            });
        }
    };

    const handleDeleteNotification = async (notificationId: string) => {
        if (loadingActions.has(notificationId)) return;

        setLoadingActions((prev) => new Set(prev).add(notificationId));
        try {
            const result = await onDeleteNotification(notificationId);
            if (result.success) {
                toast.success("Notification deleted");
            } else {
                toast.error(result.message || "Failed to delete notification");
            }
        } catch (error) {
            toast.error("Failed to delete notification");
        } finally {
            setLoadingActions((prev) => {
                const newSet = new Set(prev);
                newSet.delete(notificationId);
                return newSet;
            });
        }
    };

    const handleClearAll = async () => {
        if (loadingActions.has("clear-all")) return;

        setLoadingActions((prev) => new Set(prev).add("clear-all"));
        try {
            const result = await onClearAll();
            if (result.success) {
                toast.success("All notifications cleared");
                setIsOpen(false);
            } else {
                toast.error(
                    result.message || "Failed to clear all notifications"
                );
            }
        } catch (error) {
            toast.error("Failed to clear all notifications");
        } finally {
            setLoadingActions((prev) => {
                const newSet = new Set(prev);
                newSet.delete("clear-all");
                return newSet;
            });
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        // Mark as read if unread
        if (!notification.isRead) {
            handleMarkAsRead(notification.id);
        }

        // Navigate to order if available
        if (notification.orderId && onNavigateToOrder) {
            onNavigateToOrder(notification.orderId);
            setIsOpen(false);
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                    {unreadCount > 0 ? (
                        <BellRing className="w-4 h-4" />
                    ) : (
                        <Bell className="w-4 h-4" />
                    )}
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                        >
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold">Notifications</h3>
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleMarkAllAsRead}
                                disabled={loadingActions.has("mark-all")}
                                className="text-xs"
                            >
                                <CheckCheck className="w-3 h-3 mr-1" />
                                Mark all read
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClearAll}
                                disabled={loadingActions.has("clear-all")}
                                className="text-xs text-destructive hover:text-destructive"
                            >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Clear all
                            </Button>
                        )}
                    </div>
                </div>

                <ScrollArea className="h-96">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Bell className="w-8 h-8 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                                No notifications
                            </p>
                            <p className="text-xs text-muted-foreground">
                                You're all caught up!
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 hover:bg-muted/50 transition-colors ${
                                        !notification.isRead
                                            ? "bg-blue-50/50 dark:bg-blue-950/20"
                                            : ""
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 mt-0.5">
                                            {getNotificationIcon(
                                                notification.type
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <p
                                                        className={`text-sm font-medium ${
                                                            !notification.isRead
                                                                ? "text-foreground"
                                                                : "text-muted-foreground"
                                                        }`}
                                                    >
                                                        {notification.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {notification.message}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        {formatDistanceToNow(
                                                            new Date(
                                                                notification.createdAt
                                                            ),
                                                            { addSuffix: true }
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {!notification.isRead && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleMarkAsRead(
                                                                    notification.id
                                                                );
                                                            }}
                                                            disabled={loadingActions.has(
                                                                notification.id
                                                            )}
                                                            className="h-6 w-6 p-0"
                                                        >
                                                            <Check className="w-3 h-3" />
                                                        </Button>
                                                    )}
                                                    {notification.orderId && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleNotificationClick(
                                                                    notification
                                                                );
                                                            }}
                                                            className="h-6 w-6 p-0"
                                                        >
                                                            <ExternalLink className="w-3 h-3" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteNotification(
                                                                notification.id
                                                            );
                                                        }}
                                                        disabled={loadingActions.has(
                                                            notification.id
                                                        )}
                                                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
