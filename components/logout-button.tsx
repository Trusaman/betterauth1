"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
    const router = useRouter();

    const handleSignOut = async () => {
        await authClient.signOut();
        router.push("/login");
    };

    return (
        <button
            onClick={handleSignOut}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
            Sign Out
        </button>
    );
}
