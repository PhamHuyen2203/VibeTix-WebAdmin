import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../common/assert-admin';
import { writeAuditLog } from '../common/audit-log';
import { db, auth, COLLECTIONS } from '../auth/verifyAdmin';
export const setUserActive = onCall({ region: 'asia-southeast1' }, async (request) => {
    const adminUser = await assertAdmin(request);
    const { userId, active } = request.data;
    if (!userId || typeof userId !== 'string') {
        throw new HttpsError('invalid-argument', 'userId is required.');
    }
    if (typeof active !== 'boolean') {
        throw new HttpsError('invalid-argument', 'active parameter must be a boolean.');
    }
    const ref = db.collection(COLLECTIONS.users).doc(userId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new HttpsError('not-found', 'User not found.');
    }
    const userData = snap.data();
    if (userData['role'] === 'admin' || userData['role'] === 'superAdmin') {
        throw new HttpsError('permission-denied', 'Cannot modify admin accounts.');
    }
    const newStatus = active ? 'active' : 'disabled';
    const prevStatus = userData['status'];
    await ref.update({ status: newStatus, updatedAt: new Date() });
    await auth.updateUser(userId, { disabled: !active });
    await writeAuditLog(adminUser.uid, adminUser.displayName, active ? 'user.enable' : 'user.disable', 'user', userId, { previousStatus: prevStatus, newStatus });
    return { success: true };
});
//# sourceMappingURL=set-user-active.js.map