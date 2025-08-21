import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";
import { createAccessControl } from "better-auth/plugins/access";

/**
 * make sure to use `as const` so typescript can infer the type correctly
 */
const statement = {
    ...defaultStatements,
    order: ["create", "read", "update", "delete", "approve"],
} as const;

export const ac = createAccessControl(statement);

export const staff = ac.newRole({
    order: ["create", "read", "update"],
});

export const manager = ac.newRole({
    order: ["create", "read", "update", "approve"],
});

export const accountant = ac.newRole({
    order: ["create", "update", "delete", "approve", "read"],
});

export const admin = ac.newRole({
    ...adminAc.statements,
    order: ["create", "update", "delete", "approve", "read"],
});
