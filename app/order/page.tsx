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
import { toast } from "sonner";
import { createOrder, getOrders, updateOrderStatus } from "@/lib/orders";
import { authClient } from "@/lib/auth-client";

interface OrderItem {
    id: string;
    name: string;
    price: string;
    quantity: number;
}

interface Order {
    id: string;
    customerName: string;
    items: OrderItem[];
    total: string;
    status: "pending" | "processing" | "completed" | "cancelled";
    createdAt: Date;
}

export default function OrderPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [newOrder, setNewOrder] = useState({
        customerName: "",
        itemName: "",
        itemPrice: "",
        quantity: "1",
    });

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        const { data: session } = await authClient.getSession();
        if (!session?.user?.id) {
            toast.error("Please sign in to view orders");
            return;
        }

        try {
            const data = await getOrders(session.user.id);
            const groupedOrders = data.reduce((acc: Order[], row) => {
                const existingOrder = acc.find((o) => o.id === row.id);
                if (existingOrder && row.items.id) {
                    existingOrder.items.push(row.items);
                } else if (row.items.id) {
                    acc.push({
                        id: row.id,
                        customerName: row.customerName,
                        total: row.total,
                        status: row.status as Order["status"],
                        createdAt: new Date(row.createdAt),
                        items: [row.items],
                    });
                }
                return acc;
            }, []);
            setOrders(groupedOrders);
        } catch (error) {
            toast.error("Failed to load orders");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateOrderStatus = async (
        orderId: string,
        status: Order["status"]
    ) => {
        try {
            await updateOrderStatus(orderId, status);
            setOrders((prev) =>
                prev.map((order) =>
                    order.id === orderId ? { ...order, status } : order
                )
            );
            toast.success(`Order status updated to ${status}`);
        } catch (error) {
            toast.error("Failed to update order status");
        }
    };

    const addOrder = async () => {
        if (
            !newOrder.customerName ||
            !newOrder.itemName ||
            !newOrder.itemPrice
        ) {
            toast.error("Please fill all required fields");
            return;
        }

        const { data: session } = await authClient.getSession();
        if (!session?.user?.id) {
            toast.error("Please sign in to create orders");
            return;
        }

        const price = parseFloat(newOrder.itemPrice);
        const quantity = parseInt(newOrder.quantity);

        if (isNaN(price) || isNaN(quantity) || price <= 0 || quantity <= 0) {
            toast.error("Please enter valid price and quantity");
            return;
        }

        try {
            await createOrder({
                customerName: newOrder.customerName,
                items: [
                    {
                        name: newOrder.itemName,
                        price,
                        quantity,
                    },
                ],
                userId: session.user.id,
            });

            setNewOrder({
                customerName: "",
                itemName: "",
                itemPrice: "",
                quantity: "1",
            });
            toast.success("Order created successfully");
            loadOrders();
        } catch (error) {
            toast.error("Failed to create order");
        }
    };

    const getStatusColor = (status: Order["status"]) => {
        switch (status) {
            case "pending":
                return "text-yellow-600";
            case "processing":
                return "text-blue-600";
            case "completed":
                return "text-green-600";
            case "cancelled":
                return "text-red-600";
            default:
                return "text-gray-600";
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <h1 className="text-3xl font-bold">Order Management</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Create New Order</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Input
                            placeholder="Customer Name"
                            value={newOrder.customerName}
                            onChange={(e) =>
                                setNewOrder((prev) => ({
                                    ...prev,
                                    customerName: e.target.value,
                                }))
                            }
                        />
                        <Input
                            placeholder="Item Name"
                            value={newOrder.itemName}
                            onChange={(e) =>
                                setNewOrder((prev) => ({
                                    ...prev,
                                    itemName: e.target.value,
                                }))
                            }
                        />
                        <Input
                            type="number"
                            placeholder="Price"
                            value={newOrder.itemPrice}
                            onChange={(e) =>
                                setNewOrder((prev) => ({
                                    ...prev,
                                    itemPrice: e.target.value,
                                }))
                            }
                        />
                        <Input
                            type="number"
                            placeholder="Quantity"
                            value={newOrder.quantity}
                            onChange={(e) =>
                                setNewOrder((prev) => ({
                                    ...prev,
                                    quantity: e.target.value,
                                }))
                            }
                        />
                    </div>
                    <Button onClick={addOrder}>Create Order</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Orders ({orders.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order ID</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        className="text-center py-8"
                                    >
                                        Loading orders...
                                    </TableCell>
                                </TableRow>
                            ) : orders.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        className="text-center py-8"
                                    >
                                        No orders found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                orders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">
                                            {order.id}
                                        </TableCell>
                                        <TableCell>
                                            {order.customerName}
                                        </TableCell>
                                        <TableCell>
                                            {order.items.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="text-sm"
                                                >
                                                    {item.name} (x
                                                    {item.quantity})
                                                </div>
                                            ))}
                                        </TableCell>
                                        <TableCell>
                                            $
                                            {parseFloat(order.total).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className={`font-medium capitalize ${getStatusColor(
                                                    order.status
                                                )}`}
                                            >
                                                {order.status}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {order.createdAt.toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                {order.status === "pending" && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() =>
                                                            handleUpdateOrderStatus(
                                                                order.id,
                                                                "processing"
                                                            )
                                                        }
                                                    >
                                                        Process
                                                    </Button>
                                                )}
                                                {order.status ===
                                                    "processing" && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() =>
                                                            handleUpdateOrderStatus(
                                                                order.id,
                                                                "completed"
                                                            )
                                                        }
                                                    >
                                                        Complete
                                                    </Button>
                                                )}
                                                {(order.status === "pending" ||
                                                    order.status ===
                                                        "processing") && (
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() =>
                                                            handleUpdateOrderStatus(
                                                                order.id,
                                                                "cancelled"
                                                            )
                                                        }
                                                    >
                                                        Cancel
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
