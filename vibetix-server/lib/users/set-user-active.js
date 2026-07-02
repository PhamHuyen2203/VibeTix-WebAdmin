"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUserActive = void 0;
const https_1 = require("firebase-functions/v2/https");
const assert_admin_1 = require("../common/assert-admin");
const audit_log_1 = require("../common/audit-log");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.setUserActive = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const adminUser = await (0, assert_admin_1.assertAdmin)(request);
    const { userId, active } = request.data;
    if (!userId || typeof userId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'userId is required.');
    }
    if (typeof active !== 'boolean') {
        throw new https_1.HttpsError('invalid-argument', 'active parameter must be a boolean.');
    }
    const ref = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.users).doc(userId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'User not found.');
    }
    const userData = snap.data();
    if (userData['role'] === 'admin' || userData['role'] === 'superAdmin') {
        throw new https_1.HttpsError('permission-denied', 'Cannot modify admin accounts.');
    }
    const newStatus = active ? 'active' : 'disabled';
    const prevStatus = userData['status'];
    await ref.update({ status: newStatus, updatedAt: new Date() });
    await verifyAdmin_1.auth.updateUser(userId, { disabled: !active });
    await (0, audit_log_1.writeAuditLog)(adminUser.uid, adminUser.displayName, active ? 'user.enable' : 'user.disable', 'user', userId, { previousStatus: prevStatus, newStatus });
    return { success: true };
});
//# sourceMappingURL=set-user-active.js.map