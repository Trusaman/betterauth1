import { db } from "@/db/drizzle";
import { orders } from "@/db/order-schema";
import { eq, isNull } from "drizzle-orm";

async function fixExistingOrders() {
  try {
    console.log("Checking for orders without order numbers...");
    
    // Find orders without order numbers
    const ordersWithoutNumbers = await db
      .select()
      .from(orders)
      .where(isNull(orders.orderNumber));
    
    console.log(`Found ${ordersWithoutNumbers.length} orders without order numbers`);
    
    // Update each order with a unique order number
    for (const order of ordersWithoutNumbers) {
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await db
        .update(orders)
        .set({ orderNumber })
        .where(eq(orders.id, order.id));
      
      console.log(`Updated order ${order.id} with order number: ${orderNumber}`);
    }
    
    console.log("Migration fix completed successfully!");
  } catch (error) {
    console.error("Error fixing migration:", error);
    process.exit(1);
  }
}

fixExistingOrders();
