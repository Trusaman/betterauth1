import { createAccessControl } from "better-auth/plugins/access";

/**
 * make sure to use `as const` so typescript can infer the type correctly
 */
const statement = {
    order: ["create", "read", "update", "delete", "approve"],
} as const;

const ac = createAccessControl(statement);

export const staff = ac.newRole({
    order: ["create", "read", "update"],
});

export const manager = ac.newRole({
    order: ["create", "read", "update", "approve"],
});

export const accountant = ac.newRole({
    order: ["create", "update", "delete", "approve", "read"],
});
