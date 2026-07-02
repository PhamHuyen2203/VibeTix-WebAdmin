"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetUserPassword = exports.updateUserStatus = void 0;
const https_1 = require("firebase-functions/v2/https");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.updateUserStatus = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const adminUser = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { userId, status } = request.data;
    if (!userId)
        throw new https_1.HttpsError('invalid-argument', 'userId is required.');
    const allowedStatuses = ['active', 'disabled', 'suspended'];
    if (!status || !allowedStatuses.includes(status)) {
        throw new https_1.HttpsError('invalid-argument', `status must be one of: ${allowedStatuses.join(', ')}.`);
    }
    // Check user exists
    const userDoc = await verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.users).doc(userId).get();
    if (!userDoc.exists)
        throw new https_1.HttpsError('not-found', 'User not found.');
    // Prevent admins from disabling other admins (safety guardrail)
    const userData = userDoc.data();
    if (userData['role'] === 'admin' || userData['role'] === 'superAdmin') {
        throw new https_1.HttpsError('permission-denied', 'Cannot change status of another admin account.');
    }
    const prev = userData['status'];
    // Update Firestore
    await verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.users).doc(userId).update({ status, updatedAt: new Date() });
    // Also disable/enable in Firebase Auth
    if (status === 'disabled') {
        await verifyAdmin_1.auth.updateUser(userId, { disabled: true });
    }
    else if (status === 'active') {
        await verifyAdmin_1.auth.updateUser(userId, { disabled: false });
    }
    await (0, verifyAdmin_1.writeAuditLog)(adminUser.uid, adminUser.displayName, `user.${status === 'disabled' ? 'disable' : status === 'suspended' ? 'suspend' : 'enable'}`, 'user', userId, { previousStatus: prev, newStatus: status });
    return { success: true };
});
exports.resetUserPassword = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const adminUser = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { userId } = request.data;
    if (!userId)
        throw new https_1.HttpsError('invalid-argument', 'userId is required.');
    const userRecord = await verifyAdmin_1.auth.getUser(userId).catch(() => {
        throw new https_1.HttpsError('not-found', 'User not found in Firebase Auth.');
    });
    if (!userRecord.email)
        throw new https_1.HttpsError('failed-precondition', 'User has no email address.');
    await verifyAdmin_1.auth.generatePasswordResetLink(userRecord.email);
    // In production: send via email service
    await (0, verifyAdmin_1.writeAuditLog)(adminUser.uid, adminUser.displayName, 'user.reset_password', 'user', userId, { email: userRecord.email });
    return { success: true };
});
//# sourceMappingURL=userFunctions.js.map