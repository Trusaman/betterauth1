import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Store active connections
const connections = new Map<string, WritableStreamDefaultWriter>();

// Helper function to send data to a specific user
export async function sendToUser(userId: string, data: any) {
    const writer = connections.get(userId);
    if (writer) {
        try {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            await writer.write(new TextEncoder().encode(message));
        } catch (error) {
            console.error("Failed to send SSE message to user:", userId, error);
            // Remove broken connection
            connections.delete(userId);
        }
    }
}

// Helper function to send data to users with specific roles
export async function sendToRole(
    role: string,
    data: any,
    excludeUserId?: string
) {
    for (const [userId, writer] of connections.entries()) {
        if (excludeUserId && userId === excludeUserId) continue;

        try {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            await writer.write(new TextEncoder().encode(message));
        } catch (error) {
            console.error("Failed to send SSE message to user:", userId, error);
            connections.delete(userId);
        }
    }
}

// Helper function to broadcast to all connected users
export async function broadcast(data: any, excludeUserId?: string) {
    for (const [userId, writer] of connections.entries()) {
        if (excludeUserId && userId === excludeUserId) continue;

        try {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            await writer.write(new TextEncoder().encode(message));
        } catch (error) {
            console.error(
                "Failed to broadcast SSE message to user:",
                userId,
                error
            );
            connections.delete(userId);
        }
    }
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
        const userRole = session.user.role;

        // Create a readable stream for SSE
        const stream = new ReadableStream({
            start(controller) {
                const writer = controller;

                // Store the connection
                connections.set(userId, writer as any);

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
                    writer.enqueue(new TextEncoder().encode(initialMessage));
                } catch (error) {
                    console.error("Failed to send initial SSE message:", error);
                }

                // Send periodic heartbeat to keep connection alive
                const heartbeatInterval = setInterval(() => {
                    try {
                        const heartbeat = `data: ${JSON.stringify({
                            type: "heartbeat",
                            data: { timestamp: new Date().toISOString() },
                        })}\n\n`;

                        writer.enqueue(new TextEncoder().encode(heartbeat));
                    } catch (error) {
                        console.error("Failed to send heartbeat:", error);
                        clearInterval(heartbeatInterval);
                        connections.delete(userId);
                    }
                }, 30000); // Send heartbeat every 30 seconds

                // Handle connection cleanup
                request.signal.addEventListener("abort", () => {
                    clearInterval(heartbeatInterval);
                    connections.delete(userId);
                    console.log(`SSE connection closed for user: ${userId}`);
                });
            },

            cancel() {
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
