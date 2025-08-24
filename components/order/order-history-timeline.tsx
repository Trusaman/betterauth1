"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Clock, User, FileText, CheckCircle, XCircle, Package, Truck, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface OrderHistoryEntry {
    id: string;
    action: string;
    fromStatus?: string;
    toStatus?: string;
    fieldChanges?: string;
    performedBy?: string;
    reason?: string;
    notes?: string;
    createdAt: string;
    performedByUser?: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
}

interface OrderHistoryTimelineProps {
    orderId: string;
    orderHistory: OrderHistoryEntry[];
}

const getActionIcon = (action: string, toStatus?: string) => {
    switch (action) {
        case "order_created":
            return <FileText className="w-4 h-4 text-blue-500" />;
        case "status_changed":
            switch (toStatus) {
                case "approved":
                    return <CheckCircle className="w-4 h-4 text-green-500" />;
                case "rejected":
                case "warehouse_rejected":
                    return <XCircle className="w-4 h-4 text-red-500" />;
                case "warehouse_confirmed":
                    return <Package className="w-4 h-4 text-blue-500" />;
                case "shipped":
                    return <Truck className="w-4 h-4 text-purple-500" />;
                case "completed":
                    return <CheckCircle className="w-4 h-4 text-green-600" />;
                case "failed":
                    return <AlertTriangle className="w-4 h-4 text-red-600" />;
                default:
                    return <Clock className="w-4 h-4 text-gray-500" />;
            }
        case "field_updated":
            return <FileText className="w-4 h-4 text-orange-500" />;
        case "comment_added":
            return <FileText className="w-4 h-4 text-blue-400" />;
        default:
            return <Clock className="w-4 h-4 text-gray-500" />;
    }
};

const getActionColor = (action: string, toStatus?: string) => {
    switch (action) {
        case "order_created":
            return "bg-blue-100 border-blue-200";
        case "status_changed":
            switch (toStatus) {
                case "approved":
                case "completed":
                    return "bg-green-100 border-green-200";
                case "rejected":
                case "warehouse_rejected":
                case "failed":
                    return "bg-red-100 border-red-200";
                case "warehouse_confirmed":
                    return "bg-blue-100 border-blue-200";
                case "shipped":
                    return "bg-purple-100 border-purple-200";
                default:
                    return "bg-gray-100 border-gray-200";
            }
        case "field_updated":
            return "bg-orange-100 border-orange-200";
        case "comment_added":
            return "bg-blue-50 border-blue-100";
        default:
            return "bg-gray-100 border-gray-200";
    }
};

const formatActionDescription = (entry: OrderHistoryEntry) => {
    const { action, fromStatus, toStatus, reason, notes, performedByUser } = entry;
    const userName = performedByUser?.name || "Unknown User";
    const userRole = performedByUser?.role || "";

    switch (action) {
        case "order_created":
            return `Order created by ${userName} (${userRole})`;
        case "status_changed":
            if (fromStatus && toStatus) {
                let statusText = `Status changed from ${fromStatus} to ${toStatus}`;
                if (reason) {
                    statusText += ` - Reason: ${reason}`;
                }
                return statusText;
            }
            return "Status updated";
        case "field_updated":
            return `Order details updated by ${userName} (${userRole})`;
        case "comment_added":
            return `Comment added by ${userName} (${userRole})`;
        default:
            return `${action} by ${userName} (${userRole})`;
    }
};

const parseFieldChanges = (fieldChanges?: string) => {
    if (!fieldChanges) return null;
    try {
        return JSON.parse(fieldChanges);
    } catch {
        return null;
    }
};

export function OrderHistoryTimeline({ orderId, orderHistory }: OrderHistoryTimelineProps) {
    const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

    const toggleExpanded = (entryId: string) => {
        const newExpanded = new Set(expandedEntries);
        if (newExpanded.has(entryId)) {
            newExpanded.delete(entryId);
        } else {
            newExpanded.add(entryId);
        }
        setExpandedEntries(newExpanded);
    };

    const sortedHistory = [...orderHistory].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Order History Timeline
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {sortedHistory.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No history entries found for this order.
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
                            
                            {sortedHistory.map((entry, index) => {
                                const isExpanded = expandedEntries.has(entry.id);
                                const fieldChanges = parseFieldChanges(entry.fieldChanges);
                                const hasDetails = entry.reason || entry.notes || fieldChanges;

                                return (
                                    <div key={entry.id} className="relative flex gap-4">
                                        {/* Timeline dot */}
                                        <div className={`
                                            relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2
                                            ${getActionColor(entry.action, entry.toStatus)}
                                        `}>
                                            {getActionIcon(entry.action, entry.toStatus)}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 pb-8">
                                            <div className="bg-white border rounded-lg p-4 shadow-sm">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <h4 className="font-medium text-sm">
                                                            {formatActionDescription(entry)}
                                                        </h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-xs text-muted-foreground">
                                                                {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                                                            </span>
                                                            {entry.performedByUser && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    {entry.performedByUser.role}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {new Date(entry.createdAt).toLocaleString()}
                                                    </div>
                                                </div>

                                                {hasDetails && (
                                                    <div className="mt-3">
                                                        <button
                                                            onClick={() => toggleExpanded(entry.id)}
                                                            className="text-xs text-blue-600 hover:text-blue-800"
                                                        >
                                                            {isExpanded ? "Hide details" : "Show details"}
                                                        </button>

                                                        {isExpanded && (
                                                            <div className="mt-2 space-y-2">
                                                                {entry.reason && (
                                                                    <div>
                                                                        <span className="text-xs font-medium">Reason:</span>
                                                                        <p className="text-xs text-muted-foreground mt-1">
                                                                            {entry.reason}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                {entry.notes && (
                                                                    <div>
                                                                        <span className="text-xs font-medium">Notes:</span>
                                                                        <p className="text-xs text-muted-foreground mt-1">
                                                                            {entry.notes}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                {fieldChanges && (
                                                                    <div>
                                                                        <span className="text-xs font-medium">Changes:</span>
                                                                        <div className="mt-1 space-y-1">
                                                                            {Object.entries(fieldChanges).map(([field, value]) => (
                                                                                <div key={field} className="text-xs">
                                                                                    <span className="font-medium">{field}:</span>
                                                                                    <span className="text-muted-foreground ml-1">
                                                                                        {typeof value === 'object' 
                                                                                            ? JSON.stringify(value)
                                                                                            : String(value)
                                                                                        }
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
