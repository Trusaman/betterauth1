import { db } from "@/db/drizzle";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { schema } from "@/db/auth-schema";
import { nextCookies } from "better-auth/next-js";
import { admin as adminPlugin } from "better-auth/plugins";

import { ac, accountant, manager, staff, admin } from "@/server/permissions";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),

    emailAndPassword: {
        enabled: true,
    },

    plugins: [
        nextCookies(),
        adminPlugin({
            ac,
            roles: { staff, manager, accountant, admin },
        }),
    ],
});
