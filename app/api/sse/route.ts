import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Store active connections with proper typing
interface SSEConnection {
    controller: ReadableStreamDefaultController<Uint8Array>;
    userId: string;
    userRole: string;
    connectedAt: Date;
}

const connections = new Map<string, SSEConnection>();

// Helper function to send data to a specific user
export async function sendToUser(userId: string, data: any) {
    const connection = connections.get(userId);
    if (connection) {
        try {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            connection.controller.enqueue(new TextEncoder().encode(message));
            console.log(`SSE message sent to user ${userId}:`, data.type);
        } catch (error) {
            console.error("Failed to send SSE message to user:", userId, error);
            // Remove broken connection
            connections.delete(userId);
        }
    } else {
        console.log(`No active SSE connection found for user: ${userId}`);
    }
}

// Helper function to send data to users with specific roles
export async function sendToRole(
    role: string,
    data: any,
    excludeUserId?: string
) {
    let sentCount = 0;
    for (const [userId, connection] of connections.entries()) {
        if (excludeUserId && userId === excludeUserId) continue;
        if (connection.userRole !== role) continue;

        try {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            connection.controller.enqueue(new TextEncoder().encode(message));
            sentCount++;
        } catch (error) {
            console.error("Failed to send SSE message to user:", userId, error);
            connections.delete(userId);
        }
    }
    console.log(
        `SSE message sent to ${sentCount} users with role ${role}:`,
        data.type
    );
}

// Helper function to broadcast to all connected users
export async function broadcast(data: any, excludeUserId?: string) {
    let sentCount = 0;
    for (const [userId, connection] of connections.entries()) {
        if (excludeUserId && userId === excludeUserId) continue;

        try {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            connection.controller.enqueue(new TextEncoder().encode(message));
            sentCount++;
        } catch (error) {
            console.error(
                "Failed to broadcast SSE message to user:",
                userId,
                error
            );
            connections.delete(userId);
        }
    }
    console.log(`SSE message broadcasted to ${sentCount} users:`, data.type);
}

// Helper function to get connection stats
export function getConnectionStats() {
    const stats = {
        totalConnections: connections.size,
        connectionsByRole: {} as Record<string, number>,
        connections: Array.from(connections.entries()).map(
            ([userId, connection]) => ({
                userId,
                userRole: connection.userRole,
                connectedAt: connection.connectedAt,
            })
        ),
    };

    for (const [, connection] of connections.entries()) {
        stats.connectionsByRole[connection.userRole] =
            (stats.connectionsByRole[connection.userRole] || 0) + 1;
    }

    return stats;
}

export async function GET(request: NextRequest) {
    try {
        // Verify authentication
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return new Response("Unauthorized", { status: 401 });
        }

        const userId = session.user.id;
        const userRole = session.user.role || "user";

        console.log(`SSE connection attempt for user: ${userId} (${userRole})`);

        // Close existing connection if any
        if (connections.has(userId)) {
            console.log(`Closing existing SSE connection for user: ${userId}`);
            connections.delete(userId);
        }

        let heartbeatInterval: NodeJS.Timeout | null = null;

        // Create a readable stream for SSE
        const stream = new ReadableStream({
            start(controller) {
                // Store the connection with proper typing
                const connection: SSEConnection = {
                    controller,
                    userId,
                    userRole,
                    connectedAt: new Date(),
                };

                connections.set(userId, connection);
                console.log(
                    `SSE connection established for user: ${userId} (${userRole})`
                );

                // Send initial connection message
                const initialMessage = `data: ${JSON.stringify({
                    type: "connection_established",
                    data: {
                        userId,
                        userRole,
                        timestamp: new Date().toISOString(),
                    },
                })}\n\n`;

                try {
                    controller.enqueue(
                        new TextEncoder().encode(initialMessage)
                    );
                } catch (error) {
                    console.error("Failed to send initial SSE message:", error);
                    connections.delete(userId);
                    return;
                }

                // Send periodic heartbeat to keep connection alive
                heartbeatInterval = setInterval(() => {
                    try {
                        const heartbeat = `data: ${JSON.stringify({
                            type: "heartbeat",
                            data: { timestamp: new Date().toISOString() },
                        })}\n\n`;

                        controller.enqueue(new TextEncoder().encode(heartbeat));
                    } catch (error) {
                        console.error("Failed to send heartbeat:", error);
                        if (heartbeatInterval) {
                            clearInterval(heartbeatInterval);
                            heartbeatInterval = null;
                        }
                        connections.delete(userId);
                    }
                }, 30000); // Send heartbeat every 30 seconds

                // Handle connection cleanup
                request.signal.addEventListener("abort", () => {
                    if (heartbeatInterval) {
                        clearInterval(heartbeatInterval);
                        heartbeatInterval = null;
                    }
                    connections.delete(userId);
                    console.log(`SSE connection closed for user: ${userId}`);
                });
            },

            cancel() {
                if (heartbeatInterval) {
                    clearInterval(heartbeatInterval);
                    heartbeatInterval = null;
                }
                connections.delete(userId);
                console.log(`SSE connection cancelled for user: ${userId}`);
            },
        });

        // Return SSE response
        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Cache-Control",
            },
        });
    } catch (error) {
        console.error("SSE endpoint error:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
