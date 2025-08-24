import { Redis } from "@upstash/redis";

// Initialize Upstash Redis client (optional)
export const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({
              url: process.env.UPSTASH_REDIS_REST_URL,
              token: process.env.UPSTASH_REDIS_REST_TOKEN,
          })
        : null;

// Types for change history
export interface ChangeHistoryEntry {
    id: string;
    entityType: "order" | "user" | "comment" | "notification";
    entityId: string;
    action: string;
    changes: Record<string, any>;
    performedBy: string;
    performedAt: string;
    metadata?: Record<string, any>;
}

// Store change history in Upstash Redis
export async function storeChangeHistory(
    entry: Omit<ChangeHistoryEntry, "id" | "performedAt">
) {
    try {
        const historyEntry: ChangeHistoryEntry = {
            ...entry,
            id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            performedAt: new Date().toISOString(),
        };

        // If Redis is not configured, just log the change and return
        if (!redis) {
            console.log(
                "Upstash Redis not configured. Change history:",
                historyEntry
            );
            return historyEntry;
        }

        // Store in Redis with a TTL of 90 days (in seconds)
        const ttl = 90 * 24 * 60 * 60; // 90 days

        // Store individual entry
        await redis.setex(
            `change_history:${historyEntry.id}`,
            ttl,
            JSON.stringify(historyEntry)
        );

        // Add to entity-specific list for easy retrieval
        await redis.lpush(
            `entity_changes:${entry.entityType}:${entry.entityId}`,
            historyEntry.id
        );

        // Add to user-specific list for audit trail
        await redis.lpush(`user_changes:${entry.performedBy}`, historyEntry.id);

        // Add to global changes list (limited to last 1000 entries)
        await redis.lpush("global_changes", historyEntry.id);
        await redis.ltrim("global_changes", 0, 999);

        return historyEntry;
    } catch (error) {
        console.error("Error storing change history:", error);
        // Don't throw error to prevent breaking the main functionality
        return null;
    }
}

// Retrieve change history for a specific entity
export async function getEntityChangeHistory(
    entityType: string,
    entityId: string,
    limit = 50
) {
    try {
        if (!redis) {
            console.log(
                "Upstash Redis not configured. Cannot retrieve change history."
            );
            return [];
        }

        const changeIds = await redis.lrange(
            `entity_changes:${entityType}:${entityId}`,
            0,
            limit - 1
        );

        if (changeIds.length === 0) {
            return [];
        }

        const changes = await Promise.all(
            changeIds.map(async (id) => {
                const data = await redis.get(`change_history:${id}`);
                return data ? JSON.parse(data as string) : null;
            })
        );

        return changes.filter(Boolean) as ChangeHistoryEntry[];
    } catch (error) {
        console.error("Error retrieving change history:", error);
        return [];
    }
}

// Retrieve change history for a specific user
export async function getUserChangeHistory(userId: string, limit = 50) {
    try {
        const changeIds = await redis.lrange(
            `user_changes:${userId}`,
            0,
            limit - 1
        );

        if (changeIds.length === 0) {
            return [];
        }

        const changes = await Promise.all(
            changeIds.map(async (id) => {
                const data = await redis.get(`change_history:${id}`);
                return data ? JSON.parse(data as string) : null;
            })
        );

        return changes.filter(Boolean) as ChangeHistoryEntry[];
    } catch (error) {
        console.error("Error retrieving user change history:", error);
        return [];
    }
}

// Get global change history (recent changes across all entities)
export async function getGlobalChangeHistory(limit = 100) {
    try {
        const changeIds = await redis.lrange("global_changes", 0, limit - 1);

        if (changeIds.length === 0) {
            return [];
        }

        const changes = await Promise.all(
            changeIds.map(async (id) => {
                const data = await redis.get(`change_history:${id}`);
                return data ? JSON.parse(data as string) : null;
            })
        );

        return changes.filter(Boolean) as ChangeHistoryEntry[];
    } catch (error) {
        console.error("Error retrieving global change history:", error);
        return [];
    }
}

// Clean up old change history (can be run as a cron job)
export async function cleanupOldChangeHistory(daysToKeep = 90) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        // This is a simplified cleanup - in production you might want to implement
        // a more sophisticated cleanup strategy
        console.log(
            `Cleanup would remove changes older than ${cutoffDate.toISOString()}`
        );

        // Implementation would scan through keys and remove old entries
        // For now, we rely on TTL for automatic cleanup
    } catch (error) {
        console.error("Error cleaning up change history:", error);
    }
}
