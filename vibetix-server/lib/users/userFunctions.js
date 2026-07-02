"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.editUser = exports.createUser = exports.resetUserPassword = exports.updateUserStatus = void 0;
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
    const isActive = status === 'active';
    await verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.users).doc(userId).update({ is_active: isActive, status, updatedAt: new Date() });
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
exports.createUser = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const adminUser = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { email, password, fullName, phone, avatarUrl } = request.data;
    if (!email || !password || !fullName) {
        throw new https_1.HttpsError('invalid-argument', 'email, password, and fullName are required.');
    }
    // 1. Create in Firebase Auth
    const userRecord = await verifyAdmin_1.auth.createUser({
        email,
        password,
        displayName: fullName,
        phoneNumber: phone || undefined,
        photoURL: avatarUrl || undefined,
    });
    // 2. Create in Firestore users collection
    const userData = {
        user_id: userRecord.uid,
        email,
        full_name: fullName,
        phone: phone || null,
        avatar_url: avatarUrl || null,
        is_active: true,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
    };
    await verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.users).doc(userRecord.uid).set(userData);
    await (0, verifyAdmin_1.writeAuditLog)(adminUser.uid, adminUser.displayName, 'user.create', 'user', userRecord.uid, { email });
    return { success: true, userId: userRecord.uid };
});
exports.editUser = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const adminUser = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { userId, email, fullName, phone, avatarUrl } = request.data;
    if (!userId)
        throw new https_1.HttpsError('invalid-argument', 'userId is required.');
    const userRef = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.users).doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists)
        throw new https_1.HttpsError('not-found', 'User not found in Firestore.');
    // 1. Update in Firebase Auth
    const authUpdates = {};
    if (email !== undefined)
        authUpdates.email = email;
    if (fullName !== undefined)
        authUpdates.displayName = fullName;
    if (phone !== undefined)
        authUpdates.phoneNumber = phone || null;
    if (avatarUrl !== undefined)
        authUpdates.photoURL = avatarUrl || null;
    await verifyAdmin_1.auth.updateUser(userId, authUpdates).catch((err) => {
        throw new https_1.HttpsError('internal', 'Auth update failed: ' + err.message);
    });
    // 2. Update in Firestore users collection
    const firestoreUpdates = { updated_at: new Date() };
    if (email !== undefined)
        firestoreUpdates.email = email;
    if (fullName !== undefined)
        firestoreUpdates.full_name = fullName;
    if (phone !== undefined)
        firestoreUpdates.phone = phone || null;
    if (avatarUrl !== undefined)
        firestoreUpdates.avatar_url = avatarUrl || null;
    await userRef.update(firestoreUpdates);
    await (0, verifyAdmin_1.writeAuditLog)(adminUser.uid, adminUser.displayName, 'user.edit', 'user', userId, { email });
    return { success: true };
});
exports.deleteUser = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const adminUser = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { userId } = request.data;
    if (!userId)
        throw new https_1.HttpsError('invalid-argument', 'userId is required.');
    // 1. Delete from Firebase Auth
    await verifyAdmin_1.auth.deleteUser(userId).catch((err) => {
        // If user is already deleted from Auth, we can still proceed to delete from Firestore
        console.warn('Auth user deletion warning: ' + err.message);
    });
    // 2. Delete from Firestore users collection
    await verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.users).doc(userId).delete();
    await (0, verifyAdmin_1.writeAuditLog)(adminUser.uid, adminUser.displayName, 'user.delete', 'user', userId, {});
    return { success: true };
});
//# sourceMappingURL=userFunctions.js.map