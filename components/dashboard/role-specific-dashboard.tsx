"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    BarChart3,
    TrendingUp,
    Clock,
    CheckCircle,
    XCircle,
    Package,
    Truck,
    Users,
    DollarSign,
    AlertTriangle,
    Activity,
} from "lucide-react";

interface DashboardMetrics {
    totalOrders: number;
    pendingOrders: number;
    approvedOrders: number;
    rejectedOrders: number;
    completedOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    recentActivity: ActivityItem[];
    roleSpecificMetrics: any;
}

interface ActivityItem {
    id: string;
    type: string;
    description: string;
    timestamp: string;
    orderId?: string;
    orderNumber?: string;
}

interface Order {
    id: string;
    orderNumber: string;
    customerName: string;
    total: string;
    status: string;
    createdAt: string;
    urgency?: "high" | "medium" | "low";
}

interface RoleSpecificDashboardProps {
    userRole: string;
    userId: string;
    metrics: DashboardMetrics;
    quickActions: Array<{
        label: string;
        action: () => void;
        icon: React.ReactNode;
        variant?: "default" | "destructive" | "outline" | "secondary";
    }>;
    priorityOrders: Order[];
    onRefresh: () => void;
}

const MetricCard = ({
    title,
    value,
    icon,
    trend,
    trendValue,
    description,
}: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: "up" | "down" | "neutral";
    trendValue?: string;
    description?: string;
}) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {trend && trendValue && (
                <div
                    className={`flex items-center text-xs ${
                        trend === "up"
                            ? "text-green-600"
                            : trend === "down"
                              ? "text-red-600"
                              : "text-gray-600"
                    }`}
                >
                    <TrendingUp
                        className={`w-3 h-3 mr-1 ${
                            trend === "down" ? "rotate-180" : ""
                        }`}
                    />
                    {trendValue}
                </div>
            )}
            {description && (
                <p className="text-xs text-muted-foreground mt-1">
                    {description}
                </p>
            )}
        </CardContent>
    </Card>
);

const getStatusColor = (status: string) => {
    switch (status) {
        case "pending":
            return "bg-yellow-100 text-yellow-800";
        case "approved":
            return "bg-blue-100 text-blue-800";
        case "rejected":
            return "bg-red-100 text-red-800";
        case "warehouse_confirmed":
            return "bg-green-100 text-green-800";
        case "shipped":
            return "bg-purple-100 text-purple-800";
        case "completed":
            return "bg-green-100 text-green-800";
        case "failed":
            return "bg-red-100 text-red-800";
        default:
            return "bg-gray-100 text-gray-800";
    }
};

const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
        case "high":
            return "bg-red-100 text-red-800";
        case "medium":
            return "bg-yellow-100 text-yellow-800";
        case "low":
            return "bg-green-100 text-green-800";
        default:
            return "bg-gray-100 text-gray-800";
    }
};

export function RoleSpecificDashboard({
    userRole,
    userId,
    metrics,
    quickActions,
    priorityOrders,
    onRefresh,
}: RoleSpecificDashboardProps) {
    const [activeTab, setActiveTab] = useState("overview");

    const getRoleSpecificMetrics = () => {
        switch (userRole) {
            case "sales":
                return [
                    {
                        title: "My Orders",
                        value: metrics.roleSpecificMetrics?.myOrders || 0,
                        icon: <Package className="h-4 w-4 text-blue-600" />,
                        description: "Orders you created",
                    },
                    {
                        title: "Pending Approval",
                        value: metrics.pendingOrders,
                        icon: <Clock className="h-4 w-4 text-yellow-600" />,
                        description: "Awaiting accountant review",
                    },
                    {
                        title: "This Month Revenue",
                        value: `$${metrics.roleSpecificMetrics?.monthlyRevenue || 0}`,
                        icon: <DollarSign className="h-4 w-4 text-green-600" />,
                        description: "From your orders",
                    },
                    {
                        title: "Conversion Rate",
                        value: `${metrics.roleSpecificMetrics?.conversionRate || 0}%`,
                        icon: (
                            <TrendingUp className="h-4 w-4 text-purple-600" />
                        ),
                        description: "Orders approved vs created",
                    },
                ];
            case "accountant":
                return [
                    {
                        title: "Pending Review",
                        value: metrics.pendingOrders,
                        icon: <Clock className="h-4 w-4 text-yellow-600" />,
                        description: "Orders awaiting approval",
                    },
                    {
                        title: "Approved Today",
                        value: metrics.roleSpecificMetrics?.approvedToday || 0,
                        icon: (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                        ),
                        description: "Orders approved today",
                    },
                    {
                        title: "Total Value Pending",
                        value: `$${metrics.roleSpecificMetrics?.pendingValue || 0}`,
                        icon: <DollarSign className="h-4 w-4 text-blue-600" />,
                        description: "Value of pending orders",
                    },
                    {
                        title: "Approval Rate",
                        value: `${metrics.roleSpecificMetrics?.approvalRate || 0}%`,
                        icon: <BarChart3 className="h-4 w-4 text-purple-600" />,
                        description: "Orders approved vs total reviewed",
                    },
                ];
            case "warehouse":
                return [
                    {
                        title: "Ready to Ship",
                        value: metrics.roleSpecificMetrics?.readyToShip || 0,
                        icon: <Package className="h-4 w-4 text-blue-600" />,
                        description: "Approved orders for confirmation",
                    },
                    {
                        title: "Confirmed Today",
                        value: metrics.roleSpecificMetrics?.confirmedToday || 0,
                        icon: (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                        ),
                        description: "Orders confirmed today",
                    },
                    {
                        title: "Inventory Alerts",
                        value:
                            metrics.roleSpecificMetrics?.inventoryAlerts || 0,
                        icon: (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                        ),
                        description: "Low stock items",
                    },
                    {
                        title: "Processing Time",
                        value: `${metrics.roleSpecificMetrics?.avgProcessingTime || 0}h`,
                        icon: <Clock className="h-4 w-4 text-purple-600" />,
                        description: "Average confirmation time",
                    },
                ];
            case "shipper":
                return [
                    {
                        title: "Ready to Ship",
                        value: metrics.roleSpecificMetrics?.readyToShip || 0,
                        icon: <Truck className="h-4 w-4 text-blue-600" />,
                        description: "Warehouse confirmed orders",
                    },
                    {
                        title: "In Transit",
                        value: metrics.roleSpecificMetrics?.inTransit || 0,
                        icon: <Package className="h-4 w-4 text-purple-600" />,
                        description: "Currently shipping",
                    },
                    {
                        title: "Delivered Today",
                        value: metrics.roleSpecificMetrics?.deliveredToday || 0,
                        icon: (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                        ),
                        description: "Completed deliveries",
                    },
                    {
                        title: "Delivery Rate",
                        value: `${metrics.roleSpecificMetrics?.deliveryRate || 0}%`,
                        icon: <TrendingUp className="h-4 w-4 text-green-600" />,
                        description: "Successful delivery rate",
                    },
                ];
            default:
                return [
                    {
                        title: "Total Orders",
                        value: metrics.totalOrders,
                        icon: <Package className="h-4 w-4 text-blue-600" />,
                        description: "All orders in system",
                    },
                    {
                        title: "Active Users",
                        value: metrics.roleSpecificMetrics?.activeUsers || 0,
                        icon: <Users className="h-4 w-4 text-green-600" />,
                        description: "Users active this month",
                    },
                    {
                        title: "Total Revenue",
                        value: `$${metrics.totalRevenue}`,
                        icon: <DollarSign className="h-4 w-4 text-green-600" />,
                        description: "All time revenue",
                    },
                    {
                        title: "System Health",
                        value: "98.5%",
                        icon: <Activity className="h-4 w-4 text-green-600" />,
                        description: "Uptime this month",
                    },
                ];
        }
    };

    const roleMetrics = getRoleSpecificMetrics();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {userRole.charAt(0).toUpperCase() + userRole.slice(1)}{" "}
                        Dashboard
                    </h1>
                    <p className="text-muted-foreground">
                        Welcome back! Here's what's happening with your orders.
                    </p>
                </div>
                <Button onClick={onRefresh} variant="outline">
                    <Activity className="w-4 h-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Quick Actions */}
            {quickActions.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {quickActions.map((action, index) => (
                                <Button
                                    key={index}
                                    onClick={action.action}
                                    variant={action.variant || "default"}
                                    size="sm"
                                >
                                    {action.icon}
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {roleMetrics.map((metric, index) => (
                    <MetricCard key={index} {...metric} />
                ))}
            </div>

            {/* Simplified overview without tabs */}
            <div className="space-y-4">
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Status Distribution */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Order Status Distribution</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Pending</span>
                                        <Badge
                                            className={getStatusColor(
                                                "pending"
                                            )}
                                        >
                                            {metrics.pendingOrders}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">
                                            Approved
                                        </span>
                                        <Badge
                                            className={getStatusColor(
                                                "approved"
                                            )}
                                        >
                                            {metrics.approvedOrders}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">
                                            Completed
                                        </span>
                                        <Badge
                                            className={getStatusColor(
                                                "completed"
                                            )}
                                        >
                                            {metrics.completedOrders}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">
                                            Rejected
                                        </span>
                                        <Badge
                                            className={getStatusColor(
                                                "rejected"
                                            )}
                                        >
                                            {metrics.rejectedOrders}
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Performance Metrics */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Performance Metrics</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">
                                            Average Order Value
                                        </span>
                                        <span className="font-medium">
                                            ${metrics.averageOrderValue}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">
                                            Total Revenue
                                        </span>
                                        <span className="font-medium">
                                            ${metrics.totalRevenue}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">
                                            Orders This Month
                                        </span>
                                        <span className="font-medium">
                                            {metrics.roleSpecificMetrics
                                                ?.monthlyOrders || 0}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Priority Orders</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {priorityOrders.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No priority orders at the moment.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {priorityOrders.map((order) => (
                                        <div
                                            key={order.id}
                                            className="flex items-center justify-between p-3 border rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <p className="font-medium">
                                                        {order.orderNumber}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {order.customerName}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {order.urgency && (
                                                    <Badge
                                                        className={getUrgencyColor(
                                                            order.urgency
                                                        )}
                                                    >
                                                        {order.urgency}
                                                    </Badge>
                                                )}
                                                <Badge
                                                    className={getStatusColor(
                                                        order.status
                                                    )}
                                                >
                                                    {order.status}
                                                </Badge>
                                                <span className="font-medium">
                                                    ${order.total}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {metrics.recentActivity.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No recent activity.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {metrics.recentActivity.map((activity) => (
                                        <div
                                            key={activity.id}
                                            className="flex items-start gap-3 p-3 border rounded-lg"
                                        >
                                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                                            <div className="flex-1">
                                                <p className="text-sm">
                                                    {activity.description}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(
                                                        activity.timestamp
                                                    ).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
