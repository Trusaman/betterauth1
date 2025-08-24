"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createOrder } from "@/server/orders";

const orderItemSchema = z.object({
    name: z.string().min(1, "Product name is required"),
    description: z.string().optional(),
    sku: z.string().optional(),
    price: z.number().min(0.01, "Price must be greater than 0"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
});

const createOrderSchema = z.object({
    customerName: z.string().min(1, "Customer name is required"),
    customerEmail: z.string().email().optional().or(z.literal("")),
    customerPhone: z.string().optional(),
    customerAddress: z.string().optional(),
    items: z.array(orderItemSchema).min(1, "At least one item is required"),
});

type CreateOrderFormData = z.infer<typeof createOrderSchema>;

interface CreateOrderFormProps {
    onSuccess?: (orderId: string, orderNumber: string) => void;
}

export function CreateOrderForm({ onSuccess }: CreateOrderFormProps) {
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<CreateOrderFormData>({
        resolver: zodResolver(createOrderSchema),
        defaultValues: {
            customerName: "",
            customerEmail: "",
            customerPhone: "",
            customerAddress: "",
            items: [
                {
                    name: "",
                    description: "",
                    sku: "",
                    price: 0,
                    quantity: 1,
                },
            ],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    });

    const addItem = () => {
        append({
            name: "",
            description: "",
            sku: "",
            price: 0,
            quantity: 1,
        });
    };

    const removeItem = (index: number) => {
        if (fields.length > 1) {
            remove(index);
        }
    };

    const calculateTotal = () => {
        const items = form.watch("items");
        return items.reduce(
            (total, item) => total + item.price * item.quantity,
            0
        );
    };

    const onSubmit = async (data: CreateOrderFormData) => {
        setIsLoading(true);

        try {
            const result = await createOrder(data);

            if (result.success) {
                toast.success(result.message);
                form.reset();
                if (onSuccess && result.orderId && result.orderNumber) {
                    onSuccess(result.orderId, result.orderNumber);
                }
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle>Create New Order</CardTitle>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                    >
                        {/* Customer Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="customerName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Customer Name *</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Enter customer name"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="customerEmail"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Customer Email</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="customer@example.com"
                                                type="email"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="customerPhone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Customer Phone</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Enter phone number"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="customerAddress"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Customer Address</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Enter customer address"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Order Items */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold">
                                    Order Items
                                </h3>
                                <Button
                                    type="button"
                                    onClick={addItem}
                                    variant="outline"
                                    size="sm"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Item
                                </Button>
                            </div>

                            {fields.map((field, index) => (
                                <Card key={field.id} className="p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.name`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        Product Name *
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Product name"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.sku`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>SKU</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="SKU"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.price`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        Price *
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="0.00"
                                                            {...field}
                                                            onChange={(e) =>
                                                                field.onChange(
                                                                    parseFloat(
                                                                        e.target
                                                                            .value
                                                                    ) || 0
                                                                )
                                                            }
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.quantity`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        Quantity *
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            placeholder="1"
                                                            {...field}
                                                            onChange={(e) =>
                                                                field.onChange(
                                                                    parseInt(
                                                                        e.target
                                                                            .value
                                                                    ) || 1
                                                                )
                                                            }
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <div className="flex items-end">
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                onClick={() =>
                                                    removeItem(index)
                                                }
                                                disabled={fields.length === 1}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name={`items.${index}.description`}
                                        render={({ field }) => (
                                            <FormItem className="mt-4">
                                                <FormLabel>
                                                    Description
                                                </FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Product description"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </Card>
                            ))}
                        </div>

                        {/* Order Summary */}
                        <Card className="p-4 bg-gray-50">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-semibold">
                                    Total Amount:
                                </span>
                                <span className="text-xl font-bold">
                                    ${calculateTotal().toFixed(2)}
                                </span>
                            </div>
                        </Card>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating Order...
                                </>
                            ) : (
                                "Create Order"
                            )}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
