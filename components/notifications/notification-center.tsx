"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellRing } from "lucide-react";

interface NotificationCenterProps {
    notifications: any[];
    unreadCount: number;
    onMarkAsRead: (notificationId: string) => Promise<void>;
    onMarkAllAsRead: () => Promise<void>;
    onDeleteNotification: (notificationId: string) => Promise<void>;
    onClearAll: () => Promise<void>;
    onNavigateToOrder?: (orderId: string) => void;
}

export function NotificationCenter({
    notifications,
    unreadCount,
    onMarkAsRead,
    onMarkAllAsRead,
    onDeleteNotification,
    onClearAll,
    onNavigateToOrder,
}: NotificationCenterProps) {
    // Simplified notification center - just show count for now
    return (
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
    );
}
