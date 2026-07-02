import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { verifyAdmin, writeAuditLog, db, auth, COLLECTIONS } from '../auth/verifyAdmin';

export const updateUserStatus = onCall({ region: 'asia-southeast1' }, async (request) => {
  const adminUser = await verifyAdmin(request);

  const { userId, status } = request.data as { userId?: string; status?: string };
  if (!userId) throw new HttpsError('invalid-argument', 'userId is required.');

  const allowedStatuses = ['active', 'disabled', 'suspended'];
  if (!status || !allowedStatuses.includes(status)) {
    throw new HttpsError('invalid-argument', `status must be one of: ${allowedStatuses.join(', ')}.`);
  }

  // Check user exists
  const userDoc = await db.collection(COLLECTIONS.users).doc(userId).get();
  if (!userDoc.exists) throw new HttpsError('not-found', 'User not found.');

  // Prevent admins from disabling other admins (safety guardrail)
  const userData = userDoc.data()!;
  if (userData['role'] === 'admin' || userData['role'] === 'superAdmin') {
    throw new HttpsError('permission-denied', 'Cannot change status of another admin account.');
  }

  const prev = userData['status'];

  // Update Firestore
  await db.collection(COLLECTIONS.users).doc(userId).update({ status, updatedAt: new Date() });

  // Also disable/enable in Firebase Auth
  if (status === 'disabled') {
    await auth.updateUser(userId, { disabled: true });
  } else if (status === 'active') {
    await auth.updateUser(userId, { disabled: false });
  }

  await writeAuditLog(adminUser.uid, adminUser.displayName, `user.${status === 'disabled' ? 'disable' : status === 'suspended' ? 'suspend' : 'enable'}`, 'user', userId, { previousStatus: prev, newStatus: status });
  return { success: true };
});

export const resetUserPassword = onCall({ region: 'asia-southeast1' }, async (request) => {
  const adminUser = await verifyAdmin(request);

  const { userId } = request.data as { userId?: string };
  if (!userId) throw new HttpsError('invalid-argument', 'userId is required.');

  const userRecord = await auth.getUser(userId).catch(() => {
    throw new HttpsError('not-found', 'User not found in Firebase Auth.');
  });

  if (!userRecord.email) throw new HttpsError('failed-precondition', 'User has no email address.');

  await auth.generatePasswordResetLink(userRecord.email);
  // In production: send via email service
  await writeAuditLog(adminUser.uid, adminUser.displayName, 'user.reset_password', 'user', userId, { email: userRecord.email });
  return { success: true };
});
