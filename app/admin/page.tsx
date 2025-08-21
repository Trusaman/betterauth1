import { auth } from "@/lib/auth";
import AdminDashboard from "./admin-client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || session.user.role !== "admin") {
        throw redirect("/");
    }

    return <AdminDashboard />;
}
