import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
const COLLECTIONS = {
    admins: 'admins',
    users: 'users',
    organizers: 'organizers',
    events: 'events',
    orders: 'orders',
    tickets: 'user_tickets',
    payments: 'payments',
    discounts: 'discounts',
    auditLogs: 'audit_logs',
};
// ─── Shared Admin Verification ──────────────────────────────────────
export async function verifyAdmin(request) {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required.');
    }
    const uid = request.auth.uid;
    const adminDoc = await db.collection(COLLECTIONS.admins).doc(uid).get();
    if (!adminDoc.exists) {
        throw new HttpsError('permission-denied', 'Admin privileges required.');
    }
    const data = adminDoc.data();
    if (data['status'] && data['status'] !== 'active') {
        throw new HttpsError('permission-denied', 'Admin account is not active.');
    }
    return {
        uid,
        displayName: data['displayName'] ?? 'Admin',
        role: data['role'] ?? 'admin',
    };
}
// ─── Audit Log Helper ────────────────────────────────────────────────
export async function writeAuditLog(adminUid, adminName, action, targetType, targetId, details) {
    await db.collection(COLLECTIONS.auditLogs).add({
        adminUid,
        adminName,
        action,
        targetType,
        targetId,
        details: details ?? {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
export { admin, db, auth, COLLECTIONS };
//# sourceMappingURL=verifyAdmin.js.map