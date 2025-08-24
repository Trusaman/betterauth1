"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    getOrdersForUser,
    approveOrder,
    rejectOrder,
    warehouseConfirmOrder,
    warehouseRejectOrder,
    shipOrder,
    completeOrder,
    failOrder,
} from "@/server/orders";
import { authClient } from "@/lib/auth-client";
import { CreateOrderForm } from "@/components/forms/create-order-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Eye } from "lucide-react";

interface OrderItem {
    id: string;
    name: string;
    description: string | null;
    sku: string | null;
    price: string;
    quantity: number;
    quantityShipped: number | null;
    quantityReturned: number | null;
    orderId: string;
    createdAt: Date;
}

interface Order {
    id: string;
    orderNumber: string;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    orderItems?: OrderItem[];
    total: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    rejectionReason: string | null;
    editRequestReason: string | null;
    warehouseConfirmedBy: string | null;
    warehouseConfirmedAt: Date | null;
    warehouseRejectionReason: string | null;
    shippedBy: string | null;
    shippedAt: Date | null;
    trackingNumber: string | null;
    shippingNotes: string | null;
    completedAt: Date | null;
    completionNotes: string | null;
}

export default function OrderPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string>("");
    const [rejectReason, setRejectReason] = useState("");
    const [selectedOrderId, setSelectedOrderId] = useState<string>("");
    const [trackingNumber, setTrackingNumber] = useState("");
    const [shippingNotes, setShippingNotes] = useState("");
    const [completionNotes, setCompletionNotes] = useState("");

    useEffect(() => {
        loadOrders();
        getUserRole();
    }, []);

    const getUserRole = async () => {
        const { data: session } = await authClient.getSession();
        if (session?.user?.role) {
            setUserRole(session.user.role);
        }
    };

    const loadOrders = async () => {
        try {
            const result = await getOrdersForUser();
            if (result.success && result.orders) {
                setOrders(result.orders);
            } else {
                toast.error(result.message || "Failed to load orders");
            }
        } catch (error) {
            toast.error("Failed to load orders");
        } finally {
            setLoading(false);
        }
    };

    const handleApproveOrder = async (orderId: string) => {
        try {
            const result = await approveOrder(orderId);
            if (result.success) {
                toast.success(result.message);
                loadOrders();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error("Failed to approve order");
        }
    };

    const handleRejectOrder = async () => {
        if (!rejectReason.trim()) {
            toast.error("Please provide a reason for rejection");
            return;
        }

        try {
            const result = await rejectOrder(selectedOrderId, rejectReason);
            if (result.success) {
                toast.success(result.message);
                setRejectReason("");
                setSelectedOrderId("");
                loadOrders();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error("Failed to reject order");
        }
    };

    const handleWarehouseConfirm = async (orderId: string) => {
        try {
            const result = await warehouseConfirmOrder(orderId);
            if (result.success) {
                toast.success(result.message);
                loadOrders();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            console.error("Warehouse confirm error:", error);
            toast.error("Failed to confirm order");
        }
    };

    const handleWarehouseReject = async () => {
        if (!rejectReason.trim()) {
            toast.error("Please provide a reason for rejection");
            return;
        }

        try {
            const result = await warehouseRejectOrder(
                selectedOrderId,
                rejectReason
            );
            if (result.success) {
                toast.success(result.message);
                setRejectReason("");
                setSelectedOrderId("");
                loadOrders();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            console.error("Warehouse reject error:", error);
            toast.error("Failed to reject order");
        }
    };

    const handleShipOrder = async () => {
        try {
            const result = await shipOrder(
                selectedOrderId,
                trackingNumber || undefined,
                shippingNotes || undefined
            );
            if (result.success) {
                toast.success(result.message);
                setTrackingNumber("");
                setShippingNotes("");
                setSelectedOrderId("");
                loadOrders();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            console.error("Ship order error:", error);
            toast.error("Failed to ship order");
        }
    };

    const handleCompleteOrder = async () => {
        try {
            const result = await completeOrder(
                selectedOrderId,
                completionNotes || undefined
            );
            if (result.success) {
                toast.success(result.message);
                setCompletionNotes("");
                setSelectedOrderId("");
                loadOrders();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            console.error("Complete order error:", error);
            toast.error("Failed to complete order");
        }
    };

    const handleFailOrder = async () => {
        if (!rejectReason.trim()) {
            toast.error("Please provide a reason for marking order as failed");
            return;
        }

        try {
            const result = await failOrder(selectedOrderId, rejectReason);
            if (result.success) {
                toast.success(result.message);
                setRejectReason("");
                setSelectedOrderId("");
                loadOrders();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            console.error("Fail order error:", error);
            toast.error("Failed to mark order as failed");
        }
    };

    const onOrderCreated = (orderId: string, orderNumber: string) => {
        toast.success(`Order ${orderNumber} created successfully!`);
        loadOrders();
    };

    const getStatusBadge = (status: string) => {
        const statusConfig = {
            pending: { variant: "secondary" as const, label: "Pending" },
            approved: { variant: "default" as const, label: "Approved" },
            edit_requested: {
                variant: "outline" as const,
                label: "Edit Requested",
            },
            rejected: { variant: "destructive" as const, label: "Rejected" },
            warehouse_confirmed: {
                variant: "default" as const,
                label: "Warehouse Confirmed",
            },
            warehouse_rejected: {
                variant: "destructive" as const,
                label: "Warehouse Rejected",
            },
            shipped: { variant: "default" as const, label: "Shipped" },
            completed: { variant: "default" as const, label: "Completed" },
            partial_complete: {
                variant: "outline" as const,
                label: "Partial Complete",
            },
            failed: { variant: "destructive" as const, label: "Failed" },
            cancelled: { variant: "destructive" as const, label: "Cancelled" },
        };

        const config = statusConfig[status as keyof typeof statusConfig] || {
            variant: "secondary" as const,
            label: status,
        };

        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <h1 className="text-3xl font-bold">Order Management</h1>

            <Tabs defaultValue="orders" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="orders">Orders</TabsTrigger>
                    {userRole === "sales" && (
                        <TabsTrigger value="create">Create Order</TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="orders" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Orders ({orders.length})
                                {userRole && (
                                    <span className="text-sm font-normal text-muted-foreground ml-2">
                                        Role: {userRole}
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Order #</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={6}
                                                className="text-center py-8"
                                            >
                                                Loading orders...
                                            </TableCell>
                                        </TableRow>
                                    ) : orders.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={6}
                                                className="text-center py-8"
                                            >
                                                No orders found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        orders.map((order) => (
                                            <TableRow key={order.id}>
                                                <TableCell className="font-medium">
                                                    {order.orderNumber}
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">
                                                            {order.customerName}
                                                        </div>
                                                        {order.customerEmail && (
                                                            <div className="text-sm text-muted-foreground">
                                                                {
                                                                    order.customerEmail
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    $
                                                    {parseFloat(
                                                        order.total
                                                    ).toFixed(2)}
                                                </TableCell>
                                                <TableCell>
                                                    {getStatusBadge(
                                                        order.status
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(
                                                        order.createdAt
                                                    ).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        {/* Accountant Actions */}
                                                        {userRole ===
                                                            "accountant" &&
                                                            order.status ===
                                                                "pending" && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() =>
                                                                            handleApproveOrder(
                                                                                order.id
                                                                            )
                                                                        }
                                                                    >
                                                                        <CheckCircle className="w-4 h-4 mr-1" />
                                                                        Approve
                                                                    </Button>
                                                                    <Dialog>
                                                                        <DialogTrigger
                                                                            asChild
                                                                        >
                                                                            <Button
                                                                                size="sm"
                                                                                variant="destructive"
                                                                                onClick={() =>
                                                                                    setSelectedOrderId(
                                                                                        order.id
                                                                                    )
                                                                                }
                                                                            >
                                                                                <XCircle className="w-4 h-4 mr-1" />
                                                                                Reject
                                                                            </Button>
                                                                        </DialogTrigger>
                                                                        <DialogContent>
                                                                            <DialogHeader>
                                                                                <DialogTitle>
                                                                                    Reject
                                                                                    Order
                                                                                </DialogTitle>
                                                                            </DialogHeader>
                                                                            <div className="space-y-4">
                                                                                <p>
                                                                                    Please
                                                                                    provide
                                                                                    a
                                                                                    reason
                                                                                    for
                                                                                    rejecting
                                                                                    this
                                                                                    order:
                                                                                </p>
                                                                                <Textarea
                                                                                    placeholder="Enter rejection reason..."
                                                                                    value={
                                                                                        rejectReason
                                                                                    }
                                                                                    onChange={(
                                                                                        e
                                                                                    ) =>
                                                                                        setRejectReason(
                                                                                            e
                                                                                                .target
                                                                                                .value
                                                                                        )
                                                                                    }
                                                                                />
                                                                                <div className="flex gap-2">
                                                                                    <Button
                                                                                        onClick={
                                                                                            handleRejectOrder
                                                                                        }
                                                                                    >
                                                                                        Reject
                                                                                        Order
                                                                                    </Button>
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        onClick={() => {
                                                                                            setRejectReason(
                                                                                                ""
                                                                                            );
                                                                                            setSelectedOrderId(
                                                                                                ""
                                                                                            );
                                                                                        }}
                                                                                    >
                                                                                        Cancel
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        </DialogContent>
                                                                    </Dialog>
                                                                </>
                                                            )}

                                                        {/* Warehouse Actions */}
                                                        {userRole ===
                                                            "warehouse" &&
                                                            order.status ===
                                                                "approved" && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() =>
                                                                            handleWarehouseConfirm(
                                                                                order.id
                                                                            )
                                                                        }
                                                                    >
                                                                        <CheckCircle className="w-4 h-4 mr-1" />
                                                                        Confirm
                                                                    </Button>
                                                                    <Dialog>
                                                                        <DialogTrigger
                                                                            asChild
                                                                        >
                                                                            <Button
                                                                                size="sm"
                                                                                variant="destructive"
                                                                                onClick={() =>
                                                                                    setSelectedOrderId(
                                                                                        order.id
                                                                                    )
                                                                                }
                                                                            >
                                                                                <XCircle className="w-4 h-4 mr-1" />
                                                                                Reject
                                                                            </Button>
                                                                        </DialogTrigger>
                                                                        <DialogContent>
                                                                            <DialogHeader>
                                                                                <DialogTitle>
                                                                                    Reject
                                                                                    Order
                                                                                    (Warehouse)
                                                                                </DialogTitle>
                                                                            </DialogHeader>
                                                                            <div className="space-y-4">
                                                                                <p>
                                                                                    Please
                                                                                    provide
                                                                                    a
                                                                                    reason
                                                                                    for
                                                                                    rejecting
                                                                                    this
                                                                                    order:
                                                                                </p>
                                                                                <Textarea
                                                                                    placeholder="Enter rejection reason..."
                                                                                    value={
                                                                                        rejectReason
                                                                                    }
                                                                                    onChange={(
                                                                                        e
                                                                                    ) =>
                                                                                        setRejectReason(
                                                                                            e
                                                                                                .target
                                                                                                .value
                                                                                        )
                                                                                    }
                                                                                />
                                                                                <div className="flex gap-2">
                                                                                    <Button
                                                                                        onClick={
                                                                                            handleWarehouseReject
                                                                                        }
                                                                                    >
                                                                                        Reject
                                                                                        Order
                                                                                    </Button>
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        onClick={() => {
                                                                                            setRejectReason(
                                                                                                ""
                                                                                            );
                                                                                            setSelectedOrderId(
                                                                                                ""
                                                                                            );
                                                                                        }}
                                                                                    >
                                                                                        Cancel
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        </DialogContent>
                                                                    </Dialog>
                                                                </>
                                                            )}

                                                        {/* Shipper Actions */}
                                                        {userRole ===
                                                            "shipper" &&
                                                            order.status ===
                                                                "warehouse_confirmed" && (
                                                                <Dialog>
                                                                    <DialogTrigger
                                                                        asChild
                                                                    >
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                setSelectedOrderId(
                                                                                    order.id
                                                                                )
                                                                            }
                                                                        >
                                                                            <CheckCircle className="w-4 h-4 mr-1" />
                                                                            Ship
                                                                        </Button>
                                                                    </DialogTrigger>
                                                                    <DialogContent>
                                                                        <DialogHeader>
                                                                            <DialogTitle>
                                                                                Ship
                                                                                Order
                                                                            </DialogTitle>
                                                                        </DialogHeader>
                                                                        <div className="space-y-4">
                                                                            <div>
                                                                                <label className="text-sm font-medium">
                                                                                    Tracking
                                                                                    Number
                                                                                    (Optional)
                                                                                </label>
                                                                                <Input
                                                                                    placeholder="Enter tracking number..."
                                                                                    value={
                                                                                        trackingNumber
                                                                                    }
                                                                                    onChange={(
                                                                                        e
                                                                                    ) =>
                                                                                        setTrackingNumber(
                                                                                            e
                                                                                                .target
                                                                                                .value
                                                                                        )
                                                                                    }
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="text-sm font-medium">
                                                                                    Shipping
                                                                                    Notes
                                                                                    (Optional)
                                                                                </label>
                                                                                <Textarea
                                                                                    placeholder="Enter shipping notes..."
                                                                                    value={
                                                                                        shippingNotes
                                                                                    }
                                                                                    onChange={(
                                                                                        e
                                                                                    ) =>
                                                                                        setShippingNotes(
                                                                                            e
                                                                                                .target
                                                                                                .value
                                                                                        )
                                                                                    }
                                                                                />
                                                                            </div>
                                                                            <div className="flex gap-2">
                                                                                <Button
                                                                                    onClick={
                                                                                        handleShipOrder
                                                                                    }
                                                                                >
                                                                                    Ship
                                                                                    Order
                                                                                </Button>
                                                                                <Button
                                                                                    variant="outline"
                                                                                    onClick={() => {
                                                                                        setTrackingNumber(
                                                                                            ""
                                                                                        );
                                                                                        setShippingNotes(
                                                                                            ""
                                                                                        );
                                                                                        setSelectedOrderId(
                                                                                            ""
                                                                                        );
                                                                                    }}
                                                                                >
                                                                                    Cancel
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    </DialogContent>
                                                                </Dialog>
                                                            )}

                                                        {userRole ===
                                                            "shipper" &&
                                                            order.status ===
                                                                "shipped" && (
                                                                <>
                                                                    <Dialog>
                                                                        <DialogTrigger
                                                                            asChild
                                                                        >
                                                                            <Button
                                                                                size="sm"
                                                                                onClick={() =>
                                                                                    setSelectedOrderId(
                                                                                        order.id
                                                                                    )
                                                                                }
                                                                            >
                                                                                <CheckCircle className="w-4 h-4 mr-1" />
                                                                                Complete
                                                                            </Button>
                                                                        </DialogTrigger>
                                                                        <DialogContent>
                                                                            <DialogHeader>
                                                                                <DialogTitle>
                                                                                    Complete
                                                                                    Order
                                                                                </DialogTitle>
                                                                            </DialogHeader>
                                                                            <div className="space-y-4">
                                                                                <div>
                                                                                    <label className="text-sm font-medium">
                                                                                        Completion
                                                                                        Notes
                                                                                        (Optional)
                                                                                    </label>
                                                                                    <Textarea
                                                                                        placeholder="Enter completion notes..."
                                                                                        value={
                                                                                            completionNotes
                                                                                        }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) =>
                                                                                            setCompletionNotes(
                                                                                                e
                                                                                                    .target
                                                                                                    .value
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                                <div className="flex gap-2">
                                                                                    <Button
                                                                                        onClick={
                                                                                            handleCompleteOrder
                                                                                        }
                                                                                    >
                                                                                        Complete
                                                                                        Order
                                                                                    </Button>
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        onClick={() => {
                                                                                            setCompletionNotes(
                                                                                                ""
                                                                                            );
                                                                                            setSelectedOrderId(
                                                                                                ""
                                                                                            );
                                                                                        }}
                                                                                    >
                                                                                        Cancel
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        </DialogContent>
                                                                    </Dialog>

                                                                    <Dialog>
                                                                        <DialogTrigger
                                                                            asChild
                                                                        >
                                                                            <Button
                                                                                size="sm"
                                                                                variant="destructive"
                                                                                onClick={() =>
                                                                                    setSelectedOrderId(
                                                                                        order.id
                                                                                    )
                                                                                }
                                                                            >
                                                                                <XCircle className="w-4 h-4 mr-1" />
                                                                                Mark
                                                                                Failed
                                                                            </Button>
                                                                        </DialogTrigger>
                                                                        <DialogContent>
                                                                            <DialogHeader>
                                                                                <DialogTitle>
                                                                                    Mark
                                                                                    Order
                                                                                    as
                                                                                    Failed
                                                                                </DialogTitle>
                                                                            </DialogHeader>
                                                                            <div className="space-y-4">
                                                                                <p>
                                                                                    Please
                                                                                    provide
                                                                                    a
                                                                                    reason
                                                                                    for
                                                                                    marking
                                                                                    this
                                                                                    order
                                                                                    as
                                                                                    failed:
                                                                                </p>
                                                                                <Textarea
                                                                                    placeholder="Enter failure reason..."
                                                                                    value={
                                                                                        rejectReason
                                                                                    }
                                                                                    onChange={(
                                                                                        e
                                                                                    ) =>
                                                                                        setRejectReason(
                                                                                            e
                                                                                                .target
                                                                                                .value
                                                                                        )
                                                                                    }
                                                                                />
                                                                                <div className="flex gap-2">
                                                                                    <Button
                                                                                        onClick={
                                                                                            handleFailOrder
                                                                                        }
                                                                                    >
                                                                                        Mark
                                                                                        as
                                                                                        Failed
                                                                                    </Button>
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        onClick={() => {
                                                                                            setRejectReason(
                                                                                                ""
                                                                                            );
                                                                                            setSelectedOrderId(
                                                                                                ""
                                                                                            );
                                                                                        }}
                                                                                    >
                                                                                        Cancel
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        </DialogContent>
                                                                    </Dialog>
                                                                </>
                                                            )}

                                                        {/* View Details Button for all roles */}
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                        >
                                                            <Eye className="w-4 h-4 mr-1" />
                                                            View
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {userRole === "sales" && (
                    <TabsContent value="create">
                        <CreateOrderForm onSuccess={onOrderCreated} />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
