"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { getDashboardMetrics } from "@/server/orders";
// import { getNotifications } from "@/server/notifications";
import { toast } from "sonner";
import { RoleSpecificDashboard } from "@/components/dashboard/role-specific-dashboard";
// import { NotificationCenter } from "@/components/notifications/notification-center";
import {
    useRealTimeUpdates,
    useRealTimeOrders,
} from "@/hooks/use-real-time-updates";
// import {
//     markNotificationAsRead,
//     markAllNotificationsAsRead,
//     deleteNotification,
//     clearAllNotifications,
// } from "@/server/notifications";
import { Plus, Package, CheckCircle, Truck, BarChart3 } from "lucide-react";
import LogoutButton from "@/components/logout-button";

export default function Dashboard() {
    const router = useRouter();
    const [userRole, setUserRole] = useState<string>("");
    const [userId, setUserId] = useState<string>("");
    const [userName, setUserName] = useState<string>("");
    const [metrics, setMetrics] = useState<any>(null);
    const [priorityOrders, setPriorityOrders] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Real-time updates
    const {
        orders,
        setOrders,
        handleOrderUpdate,
        handleNewComment,
        handleNewNotification,
        handleOrderCreated,
    } = useRealTimeOrders();

    // const { isConnected } = useRealTimeUpdates({
    //     userId,
    //     userRole,
    //     onOrderUpdate: handleOrderUpdate,
    //     onNewComment: handleNewComment,
    //     onNewNotification: handleNewNotification,
    //     onOrderCreated: handleOrderCreated,
    // });

    const loadUserInfo = async () => {
        try {
            const { data: session, error } = await authClient.getSession();
            console.log("session", session);

            if (session?.user) {
                setUserRole(session.user.role);
                setUserId(session.user.id);
                setUserName(session.user.name || session.user.email);
            } else {
                router.push("/login");

                console.log("Running");
            }
        } catch (error) {
            console.error("Failed to load user info:", error);
            console.log("Run from here");

            router.push("/login");
        }
    };

    const loadDashboardData = async () => {
        try {
            const metricsResult = await getDashboardMetrics();
            // const notificationsResult = await getNotifications();

            if (metricsResult.success) {
                setMetrics(metricsResult.metrics);
                setPriorityOrders(metricsResult.priorityOrders || []);
            }

            // if (notificationsResult.success) {
            //     setNotifications(notificationsResult.notifications || []);
            //     setUnreadCount(notificationsResult.unreadCount || 0);
            // }
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
            toast.error("Failed to load dashboard data");
        }
    };

    const refreshData = async () => {
        await loadDashboardData();
        toast.success("Dashboard refreshed");
    };

    useEffect(() => {
        loadUserInfo().then(() => {
            loadDashboardData().finally(() => setLoading(false));
        });
    }, []);

    const getQuickActions = () => {
        switch (userRole) {
            case "sales":
                return [
                    {
                        label: "Create Order",
                        action: () => router.push("/order"),
                        icon: <Plus className="w-4 h-4 mr-2" />,
                    },
                    {
                        label: "View Orders",
                        action: () => router.push("/order"),
                        icon: <Package className="w-4 h-4 mr-2" />,
                        variant: "outline" as const,
                    },
                ];
            case "accountant":
                return [
                    {
                        label: "Review Pending",
                        action: () => router.push("/order?status=pending"),
                        icon: <CheckCircle className="w-4 h-4 mr-2" />,
                    },
                    {
                        label: "View Reports",
                        action: () => router.push("/reports"),
                        icon: <BarChart3 className="w-4 h-4 mr-2" />,
                        variant: "outline" as const,
                    },
                ];
            case "warehouse":
                return [
                    {
                        label: "Ready to Ship",
                        action: () => router.push("/order?status=approved"),
                        icon: <Package className="w-4 h-4 mr-2" />,
                    },
                ];
            case "shipper":
                return [
                    {
                        label: "Ship Orders",
                        action: () =>
                            router.push("/order?status=warehouse_confirmed"),
                        icon: <Truck className="w-4 h-4 mr-2" />,
                    },
                ];
            default:
                return [
                    {
                        label: "View All Orders",
                        action: () => router.push("/order"),
                        icon: <Package className="w-4 h-4 mr-2" />,
                    },
                ];
        }
    };

    // const handleMarkAsRead = async (notificationId: string) => {
    //     const result = await markNotificationAsRead(notificationId);
    //     if (result.success) {
    //         setNotifications((prev) =>
    //             prev.map((n) =>
    //                 n.id === notificationId ? { ...n, isRead: true } : n
    //             )
    //         );
    //         setUnreadCount((prev) => Math.max(0, prev - 1));
    //     }
    // };

    // const handleMarkAllAsRead = async () => {
    //     const result = await markAllNotificationsAsRead();
    //     if (result.success) {
    //         setNotifications((prev) =>
    //             prev.map((n) => ({ ...n, isRead: true }))
    //         );
    //         setUnreadCount(0);
    //     }
    // };

    const handleDeleteNotification = async (notificationId: string) => {
        const result = await deleteNotification(notificationId);
        if (result.success) {
            setNotifications((prev) =>
                prev.filter((n) => n.id !== notificationId)
            );
            const deletedNotification = notifications.find(
                (n) => n.id === notificationId
            );
            if (deletedNotification && !deletedNotification.isRead) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
            }
        }
    };

    const handleClearAll = async () => {
        const result = await clearAllNotifications();
        if (result.success) {
            setNotifications([]);
            setUnreadCount(0);
        }
    };

    const handleNavigateToOrder = (orderId: string) => {
        router.push(`/order/${orderId}`);
    };

    if (loading) {
        return (
            <div className="container mx-auto py-8">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                        <p className="mt-2 text-muted-foreground">
                            Loading dashboard...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8">
            {/* Header with notifications */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">
                        Welcome back, {userName}!
                    </h1>
                    {/* <p className="text-muted-foreground">
                        Role: {userRole} •{" "}
                        {isConnected ? "Connected" : "Disconnected"}
                    </p> */}
                </div>
                <div className="flex items-center gap-4">
                    {/* <NotificationCenter
                        notifications={notifications}
                        unreadCount={unreadCount}
                        onMarkAsRead={handleMarkAsRead}
                        onMarkAllAsRead={handleMarkAllAsRead}
                        onDeleteNotification={handleDeleteNotification}
                        onClearAll={handleClearAll}
                        onNavigateToOrder={handleNavigateToOrder}
                    /> */}
                    <LogoutButton />
                </div>
            </div>

            {/* Role-specific dashboard */}
            {metrics && (
                <RoleSpecificDashboard
                    userRole={userRole}
                    userId={userId}
                    metrics={metrics}
                    quickActions={getQuickActions()}
                    priorityOrders={priorityOrders}
                    onRefresh={refreshData}
                />
            )}
        </div>
    );
}
