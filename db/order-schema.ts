import {
    pgTable,
    text,
    timestamp,
    decimal,
    integer,
    uuid,
    boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth-schema";

// Order status enum for the workflow
export const orderStatusEnum = [
    "pending", // Initial state when Sales creates order
    "approved", // Accountant approved
    "edit_requested", // Accountant requested edits
    "rejected", // Accountant rejected
    "warehouse_confirmed", // Warehouse confirmed inventory
    "warehouse_rejected", // Warehouse rejected
    "shipped", // Shipper marked as shipped
    "completed", // Successfully completed
    "partial_complete", // Partially completed
    "failed", // Shipping failed
    "cancelled", // Cancelled order
] as const;

export const orders = pgTable("orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number")
        .notNull()
        .unique()
        .$defaultFn(
            () => `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        ), // Auto-generated order number
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    customerAddress: text("customer_address"),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    status: text("status", { enum: orderStatusEnum })
        .notNull()
        .default("pending"),

    // User who created the order (Sales)
    createdBy: text("created_by").references(() => user.id, {
        onDelete: "set null",
    }),

    // User who last updated the order
    updatedBy: text("updated_by").references(() => user.id, {
        onDelete: "set null",
    }),

    // Approval information
    approvedBy: text("approved_by").references(() => user.id, {
        onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at"),

    // Rejection/Edit request information
    rejectionReason: text("rejection_reason"),
    editRequestReason: text("edit_request_reason"),

    // Warehouse confirmation
    warehouseConfirmedBy: text("warehouse_confirmed_by").references(
        () => user.id,
        { onDelete: "set null" }
    ),
    warehouseConfirmedAt: timestamp("warehouse_confirmed_at"),
    warehouseRejectionReason: text("warehouse_rejection_reason"),

    // Shipping information
    shippedBy: text("shipped_by").references(() => user.id, {
        onDelete: "set null",
    }),
    shippedAt: timestamp("shipped_at"),
    trackingNumber: text("tracking_number"),
    shippingNotes: text("shipping_notes"),

    // Completion information
    completedAt: timestamp("completed_at"),
    completionNotes: text("completion_notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
        .notNull()
        .references(() => orders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    sku: text("sku"), // Stock Keeping Unit
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(),
    quantityShipped: integer("quantity_shipped").default(0),
    quantityReturned: integer("quantity_returned").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Order history for tracking all changes and state transitions
export const orderHistory = pgTable("order_history", {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
        .notNull()
        .references(() => orders.id, { onDelete: "cascade" }),

    // Action details
    action: text("action").notNull(), // e.g., "status_changed", "field_updated", "comment_added"
    fromStatus: text("from_status"),
    toStatus: text("to_status"),

    // Field changes (JSON format for flexibility)
    fieldChanges: text("field_changes"), // JSON string of changed fields

    // User who performed the action
    performedBy: text("performed_by").references(() => user.id, {
        onDelete: "set null",
    }),

    // Additional context
    reason: text("reason"), // Reason for rejection, edit request, etc.
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Comments system for order discussions
export const orderComments = pgTable("order_comments", {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
        .notNull()
        .references(() => orders.id, { onDelete: "cascade" }),

    // Comment content
    content: text("content").notNull(),

    // Author information
    authorId: text("author_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),

    // Visibility control
    isInternal: boolean("is_internal").default(false), // Internal comments vs customer-visible
    visibleToRoles: text("visible_to_roles"), // JSON array of roles that can see this comment

    // Reply system
    parentCommentId: uuid("parent_comment_id").references(
        () => orderComments.id,
        { onDelete: "cascade" }
    ),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notifications system
export const notifications = pgTable("notifications", {
    id: uuid("id").primaryKey().defaultRandom(),

    // Recipient
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),

    // Notification content
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type", {
        enum: ["order_status", "comment", "assignment", "reminder"],
    })
        .notNull()
        .default("order_status"),

    // Related entities
    orderId: uuid("order_id").references(() => orders.id, {
        onDelete: "cascade",
    }),
    commentId: uuid("comment_id").references(() => orderComments.id, {
        onDelete: "cascade",
    }),

    // Status
    isRead: boolean("is_read").default(false),
    readAt: timestamp("read_at"),

    // Metadata
    metadata: text("metadata"), // JSON for additional data

    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relationships
export const ordersRelations = relations(orders, ({ many, one }) => ({
    orderItems: many(orderItems),
    orderHistory: many(orderHistory),
    orderComments: many(orderComments),
    notifications: many(notifications),
    createdByUser: one(user, {
        fields: [orders.createdBy],
        references: [user.id],
    }),
    updatedByUser: one(user, {
        fields: [orders.updatedBy],
        references: [user.id],
    }),
    approvedByUser: one(user, {
        fields: [orders.approvedBy],
        references: [user.id],
    }),
    warehouseConfirmedByUser: one(user, {
        fields: [orders.warehouseConfirmedBy],
        references: [user.id],
    }),
    shippedByUser: one(user, {
        fields: [orders.shippedBy],
        references: [user.id],
    }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
    order: one(orders, {
        fields: [orderItems.orderId],
        references: [orders.id],
    }),
}));

export const orderHistoryRelations = relations(orderHistory, ({ one }) => ({
    order: one(orders, {
        fields: [orderHistory.orderId],
        references: [orders.id],
    }),
    performedByUser: one(user, {
        fields: [orderHistory.performedBy],
        references: [user.id],
    }),
}));

export const orderCommentsRelations = relations(
    orderComments,
    ({ one, many }) => ({
        order: one(orders, {
            fields: [orderComments.orderId],
            references: [orders.id],
        }),
        author: one(user, {
            fields: [orderComments.authorId],
            references: [user.id],
        }),
        parentComment: one(orderComments, {
            fields: [orderComments.parentCommentId],
            references: [orderComments.id],
        }),
        replies: many(orderComments),
    })
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(user, {
        fields: [notifications.userId],
        references: [user.id],
    }),
    order: one(orders, {
        fields: [notifications.orderId],
        references: [orders.id],
    }),
    comment: one(orderComments, {
        fields: [notifications.commentId],
        references: [orderComments.id],
    }),
}));
