import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";
import { createAccessControl } from "better-auth/plugins/access";

/**
 * make sure to use `as const` so typescript can infer the type correctly
 */
const statement = {
    ...defaultStatements,
    order: [
        "create",
        "read",
        "update",
        "delete",
        "approve",
        "reject",
        "ship",
        "confirm",
    ],
    comment: ["create", "read", "update", "delete"],
    notification: ["create", "read", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

// Sales role - can create and read orders
export const sales = ac.newRole({
    order: ["create", "read", "update"],
    comment: ["create", "read"],
    notification: ["read"],
});

// Accountant role - can approve, reject, or request edits
export const accountant = ac.newRole({
    order: ["read", "approve", "reject", "update"],
    comment: ["create", "read"],
    notification: ["read"],
});

// Warehouse role - can confirm inventory and approve for shipping
export const warehouse = ac.newRole({
    order: ["read", "confirm", "approve", "reject"],
    comment: ["create", "read"],
    notification: ["read"],
});

// Shipper role - can update shipping status and complete orders
export const shipper = ac.newRole({
    order: ["read", "ship", "update"],
    comment: ["create", "read"],
    notification: ["read"],
});

// Admin role - full access
export const admin = ac.newRole({
    ...adminAc.statements,
    order: [
        "create",
        "read",
        "update",
        "delete",
        "approve",
        "reject",
        "ship",
        "confirm",
    ],
    comment: ["create", "read", "update", "delete"],
    notification: ["create", "read", "update", "delete"],
});
