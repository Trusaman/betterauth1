CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'order_status' NOT NULL,
	"order_id" uuid,
	"comment_id" uuid,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"content" text NOT NULL,
	"author_id" text NOT NULL,
	"is_internal" boolean DEFAULT false,
	"visible_to_roles" text,
	"parent_comment_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"field_changes" text,
	"performed_by" text,
	"reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "quantity_shipped" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "quantity_returned" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "order_number" text;--> statement-breakpoint
UPDATE "orders" SET "order_number" = 'ORD-' || EXTRACT(EPOCH FROM NOW()) || '-' || substr(md5(random()::text), 1, 9) WHERE "order_number" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "order_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_email" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_phone" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "edit_request_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "warehouse_confirmed_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "warehouse_confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "warehouse_rejection_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipped_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipped_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_notes" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "completion_notes" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_order_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."order_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_comments" ADD CONSTRAINT "order_comments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_comments" ADD CONSTRAINT "order_comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_comments" ADD CONSTRAINT "order_comments_parent_comment_id_order_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."order_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_history" ADD CONSTRAINT "order_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_history" ADD CONSTRAINT "order_history_performed_by_user_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_warehouse_confirmed_by_user_id_fk" FOREIGN KEY ("warehouse_confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipped_by_user_id_fk" FOREIGN KEY ("shipped_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_unique" UNIQUE("order_number");