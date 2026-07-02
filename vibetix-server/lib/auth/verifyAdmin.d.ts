import * as admin from 'firebase-admin';
import type { CallableRequest } from 'firebase-functions/v2/https';
declare const db: admin.firestore.Firestore;
declare const auth: import("firebase-admin/auth").Auth;
declare const COLLECTIONS: {
    readonly admins: "admins";
    readonly users: "users";
    readonly organizers: "organizers";
    readonly events: "events";
    readonly orders: "orders";
    readonly tickets: "user_tickets";
    readonly payments: "payments";
    readonly discounts: "discounts";
    readonly auditLogs: "audit_logs";
};
export declare function verifyAdmin(request: CallableRequest): Promise<{
    uid: string;
    displayName: string;
    role: string;
}>;
export declare function writeAuditLog(adminUid: string, adminName: string, action: string, targetType: string, targetId: string, details?: Record<string, unknown>): Promise<void>;
export { admin, db, auth, COLLECTIONS };
//# sourceMappingURL=verifyAdmin.d.ts.map