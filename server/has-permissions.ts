"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const canCreateOrder = async () => {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session) {
            return false;
        }

        const { success, error } = await auth.api.userHasPermission({
            body: {
                userId: session.user.id,
                permissions: {
                    order: ["create"],
                },
            },
        });

        if (error) {
            return {
                success: false,
                error: error || "Failed to check permissions",
            };
        }

        return success;
    } catch (error) {
        console.error(error);
        return {
            success: false,
            error: error || "Failed to check permissions",
        };
    }
};
