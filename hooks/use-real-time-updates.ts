"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

interface RealTimeUpdate {
    type: "order_status_changed" | "new_comment" | "new_notification" | "order_created" | "order_updated";
    data: any;
    timestamp: string;
}

interface UseRealTimeUpdatesOptions {
    userId: string;
    userRole: string;
    onOrderUpdate?: (orderId: string, newStatus: string) => void;
    onNewComment?: (orderId: string, comment: any) => void;
    onNewNotification?: (notification: any) => void;
    onOrderCreated?: (order: any) => void;
    enableBrowserNotifications?: boolean;
}

export function useRealTimeUpdates({
    userId,
    userRole,
    onOrderUpdate,
    onNewComment,
    onNewNotification,
    onOrderCreated,
    enableBrowserNotifications = true,
}: UseRealTimeUpdatesOptions) {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    // Request browser notification permission
    const requestNotificationPermission = useCallback(async () => {
        if (!enableBrowserNotifications || typeof window === "undefined") return;
        
        if ("Notification" in window && Notification.permission === "default") {
            try {
                await Notification.requestPermission();
            } catch (error) {
                console.warn("Failed to request notification permission:", error);
            }
        }
    }, [enableBrowserNotifications]);

    // Show browser notification
    const showBrowserNotification = useCallback((title: string, message: string, orderId?: string) => {
        if (!enableBrowserNotifications || typeof window === "undefined") return;
        
        if ("Notification" in window && Notification.permission === "granted") {
            const notification = new Notification(title, {
                body: message,
                icon: "/favicon.ico",
                badge: "/favicon.ico",
                tag: orderId || "general",
                requireInteraction: false,
                silent: false,
            });

            notification.onclick = () => {
                window.focus();
                if (orderId) {
                    // Navigate to order page
                    window.location.href = `/order?id=${orderId}`;
                }
                notification.close();
            };

            // Auto close after 5 seconds
            setTimeout(() => {
                notification.close();
            }, 5000);
        }
    }, [enableBrowserNotifications]);

    // Handle real-time updates
    const handleUpdate = useCallback((update: RealTimeUpdate) => {
        setLastUpdate(new Date());

        switch (update.type) {
            case "order_status_changed":
                const { orderId, newStatus, orderNumber } = update.data;
                onOrderUpdate?.(orderId, newStatus);
                
                // Show toast notification
                toast.success(`Order ${orderNumber} status changed to ${newStatus}`);
                
                // Show browser notification
                showBrowserNotification(
                    "Order Status Updated",
                    `Order ${orderNumber} is now ${newStatus}`,
                    orderId
                );
                break;

            case "new_comment":
                const { orderId: commentOrderId, comment, orderNumber: commentOrderNumber } = update.data;
                onNewComment?.(commentOrderId, comment);
                
                toast.info(`New comment on order ${commentOrderNumber}`);
                showBrowserNotification(
                    "New Comment",
                    `${comment.user.name} commented on order ${commentOrderNumber}`,
                    commentOrderId
                );
                break;

            case "new_notification":
                const notification = update.data;
                onNewNotification?.(notification);
                
                toast.info(notification.title);
                showBrowserNotification(
                    notification.title,
                    notification.message,
                    notification.orderId
                );
                break;

            case "order_created":
                const newOrder = update.data;
                onOrderCreated?.(newOrder);
                
                // Only show notification if user is not the creator
                if (newOrder.createdBy !== userId) {
                    toast.info(`New order ${newOrder.orderNumber} created`);
                    showBrowserNotification(
                        "New Order Created",
                        `Order ${newOrder.orderNumber} by ${newOrder.customerName}`,
                        newOrder.id
                    );
                }
                break;

            case "order_updated":
                const updatedOrder = update.data;
                toast.info(`Order ${updatedOrder.orderNumber} updated`);
                break;

            default:
                console.log("Unknown update type:", update.type);
        }
    }, [userId, onOrderUpdate, onNewComment, onNewNotification, onOrderCreated, showBrowserNotification]);

    // Connect to SSE endpoint
    const connect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        try {
            const eventSource = new EventSource(`/api/sse?userId=${userId}&userRole=${userRole}`);
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                setIsConnected(true);
                setConnectionError(null);
                reconnectAttempts.current = 0;
                console.log("SSE connection established");
            };

            eventSource.onmessage = (event) => {
                try {
                    const update: RealTimeUpdate = JSON.parse(event.data);
                    handleUpdate(update);
                } catch (error) {
                    console.error("Failed to parse SSE message:", error);
                }
            };

            eventSource.onerror = (error) => {
                console.error("SSE connection error:", error);
                setIsConnected(false);
                setConnectionError("Connection lost");
                
                // Attempt to reconnect with exponential backoff
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = Math.pow(2, reconnectAttempts.current) * 1000; // 1s, 2s, 4s, 8s, 16s
                    reconnectAttempts.current++;
                    
                    reconnectTimeoutRef.current = setTimeout(() => {
                        console.log(`Attempting to reconnect (attempt ${reconnectAttempts.current})`);
                        connect();
                    }, delay);
                } else {
                    setConnectionError("Failed to reconnect after multiple attempts");
                }
            };

        } catch (error) {
            console.error("Failed to create SSE connection:", error);
            setConnectionError("Failed to establish connection");
        }
    }, [userId, userRole, handleUpdate]);

    // Disconnect from SSE
    const disconnect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        
        setIsConnected(false);
        setConnectionError(null);
    }, []);

    // Manual reconnect
    const reconnect = useCallback(() => {
        disconnect();
        reconnectAttempts.current = 0;
        connect();
    }, [disconnect, connect]);

    // Initialize connection and request permissions
    useEffect(() => {
        requestNotificationPermission();
        connect();

        // Handle page visibility changes
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible" && !isConnected) {
                reconnect();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        // Cleanup on unmount
        return () => {
            disconnect();
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        isConnected,
        connectionError,
        lastUpdate,
        reconnect,
        disconnect,
    };
}

// Hook for managing real-time order updates
export function useRealTimeOrders(initialOrders: any[] = []) {
    const [orders, setOrders] = useState(initialOrders);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const handleOrderUpdate = useCallback((orderId: string, newStatus: string) => {
        setOrders(prevOrders => 
            prevOrders.map(order => 
                order.id === orderId 
                    ? { ...order, status: newStatus, updatedAt: new Date().toISOString() }
                    : order
            )
        );
    }, []);

    const handleNewComment = useCallback((orderId: string, comment: any) => {
        // This could trigger a refresh of comments for the specific order
        console.log("New comment on order:", orderId, comment);
    }, []);

    const handleNewNotification = useCallback((notification: any) => {
        setNotifications(prev => [notification, ...prev]);
        if (!notification.isRead) {
            setUnreadCount(prev => prev + 1);
        }
    }, []);

    const handleOrderCreated = useCallback((newOrder: any) => {
        setOrders(prevOrders => [newOrder, ...prevOrders]);
    }, []);

    return {
        orders,
        setOrders,
        notifications,
        setNotifications,
        unreadCount,
        setUnreadCount,
        handleOrderUpdate,
        handleNewComment,
        handleNewNotification,
        handleOrderCreated,
    };
}
