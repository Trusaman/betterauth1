import LogoutButton from "@/components/logout-button";
import { auth } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Dashboard() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        throw redirect("/login");
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
            <p>
                Welcome, {session.user.name || session.user.email} -{" "}
                {session.user.role}!
            </p>
            <LogoutButton />
        </div>
    );
}
