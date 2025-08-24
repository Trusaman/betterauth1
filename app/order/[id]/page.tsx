"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Package, User, Calendar, DollarSign, MapPin, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { OrderHistoryTimeline } from "@/components/order/order-history-timeline";
import { OrderComments } from "@/components/order/order-comments";
import { useRealTimeUpdates } from "@/hooks/use-real-time-updates";
import { 
    getOrderById, 
    getOrderHistory, 
    approveOrder, 
    rejectOrder,
    warehouseConfirmOrder,
    warehouseRejectOrder,
    shipOrder,
    completeOrder,
    failOrder 
} from "@/server/orders";
import { 
    getOrderComments, 
    addOrderComment, 
    updateOrderComment, 
    deleteOrderComment 
} from "@/server/comments";
import { authClient } from "@/lib/auth-client";

interface OrderDetails {
    id: string;
    orderNumber: string;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    total: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
    rejectionReason: string | null;
    orderItems: Array<{
        id: string;
        name: string;
        description: string | null;
        sku: string | null;
        price: string;
        quantity: number;
        quantityShipped: number | null;
        quantityReturned: number | null;
    }>;
}

export default function OrderDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = params.id as string;

    const [order, setOrder] = useState<OrderDetails | null>(null);
    const [orderHistory, setOrderHistory] = useState<any[]>([]);
    const [comments, setComments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string>("");
    const [userId, setUserId] = useState<string>("");

    // Real-time updates
    const { isConnected } = useRealTimeUpdates({
        userId,
        userRole,
        onOrderUpdate: (updatedOrderId, newStatus) => {
            if (updatedOrderId === orderId) {
                setOrder(prev => prev ? { ...prev, status: newStatus } : null);
                loadOrderHistory(); // Refresh history
            }
        },
        onNewComment: (commentOrderId, comment) => {
            if (commentOrderId === orderId) {
                loadComments(); // Refresh comments
            }
        },
    });

    const loadOrderDetails = async () => {
        try {
            const result = await getOrderById(orderId);
            if (result.success && result.order) {
                setOrder(result.order);
            } else {
                toast.error(result.message || "Failed to load order details");
                router.push("/order");
            }
        } catch (error) {
            toast.error("Failed to load order details");
            router.push("/order");
        }
    };

    const loadOrderHistory = async () => {
        try {
            const result = await getOrderHistory(orderId);
            if (result.success && result.history) {
                setOrderHistory(result.history);
            }
        } catch (error) {
            console.error("Failed to load order history:", error);
        }
    };

    const loadComments = async () => {
        try {
            const result = await getOrderComments(orderId);
            if (result.success && result.comments) {
                setComments(result.comments);
            }
        } catch (error) {
            console.error("Failed to load comments:", error);
        }
    };

    const loadUserInfo = async () => {
        try {
            const session = await authClient.getSession();
            if (session?.user) {
                setUserRole(session.user.role);
                setUserId(session.user.id);
            }
        } catch (error) {
            console.error("Failed to load user info:", error);
        }
    };

    useEffect(() => {
        if (orderId) {
            Promise.all([
                loadOrderDetails(),
                loadOrderHistory(),
                loadComments(),
                loadUserInfo(),
            ]).finally(() => setLoading(false));
        }
    }, [orderId]);

    const handleAddComment = async (content: string, parentId?: string, isInternal?: boolean) => {
        const result = await addOrderComment(orderId, content, parentId, isInternal);
        if (result.success) {
            await loadComments();
        } else {
            throw new Error(result.message);
        }
    };

    const handleUpdateComment = async (commentId: string, content: string) => {
        const result = await updateOrderComment(commentId, content);
        if (result.success) {
            await loadComments();
        } else {
            throw new Error(result.message);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        const result = await deleteOrderComment(commentId);
        if (result.success) {
            await loadComments();
        } else {
            throw new Error(result.message);
        }
    };

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

    if (loading) {
        return (
            <div className="container mx-auto py-8">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                        <p className="mt-2 text-muted-foreground">Loading order details...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="container mx-auto py-8">
                <div className="text-center">
                    <h1 className="text-2xl font-bold">Order Not Found</h1>
                    <p className="text-muted-foreground mt-2">The requested order could not be found.</p>
                    <Button onClick={() => router.push("/order")} className="mt-4">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Orders
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push("/order")}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">Order {order.orderNumber}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge className={getStatusColor(order.status)}>
                                {order.status}
                            </Badge>
                            {isConnected && (
                                <Badge variant="outline" className="text-green-600">
                                    Live Updates
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Order Overview */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Customer Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Customer Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{order.customerName}</span>
                        </div>
                        {order.customerEmail && (
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <span>{order.customerEmail}</span>
                            </div>
                        )}
                        {order.customerPhone && (
                            <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-muted-foreground" />
                                <span>{order.customerPhone}</span>
                            </div>
                        )}
                        {order.customerAddress && (
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                <span>{order.customerAddress}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Order Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            Order Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Total Amount:</span>
                            <span className="font-bold text-lg">${order.total}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Created:</span>
                            <span>{new Date(order.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Last Updated:</span>
                            <span>{new Date(order.updatedAt).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Items:</span>
                            <span>{order.orderItems.length} item{order.orderItems.length !== 1 ? "s" : ""}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Order Items */}
            <Card>
                <CardHeader>
                    <CardTitle>Order Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {order.orderItems.map((item, index) => (
                            <div key={item.id}>
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h4 className="font-medium">{item.name}</h4>
                                        {item.description && (
                                            <p className="text-sm text-muted-foreground">{item.description}</p>
                                        )}
                                        {item.sku && (
                                            <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium">${item.price} × {item.quantity}</p>
                                        <p className="text-sm text-muted-foreground">
                                            Total: ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                                {index < order.orderItems.length - 1 && <Separator className="mt-3" />}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Tabs for History and Comments */}
            <Tabs defaultValue="history" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="history">Order History</TabsTrigger>
                    <TabsTrigger value="comments">
                        Comments ({comments.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="history">
                    <OrderHistoryTimeline 
                        orderId={orderId} 
                        orderHistory={orderHistory} 
                    />
                </TabsContent>

                <TabsContent value="comments">
                    <OrderComments
                        orderId={orderId}
                        userRole={userRole}
                        userId={userId}
                        comments={comments}
                        onAddComment={handleAddComment}
                        onUpdateComment={handleUpdateComment}
                        onDeleteComment={handleDeleteComment}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
