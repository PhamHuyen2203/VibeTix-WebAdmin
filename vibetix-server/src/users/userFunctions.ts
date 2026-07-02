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
  const isActive = status === 'active';
  await db.collection(COLLECTIONS.users).doc(userId).update({ is_active: isActive, status, updatedAt: new Date() });

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

export const createUser = onCall({ region: 'asia-southeast1' }, async (request) => {
  const adminUser = await verifyAdmin(request);

  const { email, password, fullName, phone, avatarUrl } = request.data as {
    email?: string;
    password?: string;
    fullName?: string;
    phone?: string;
    avatarUrl?: string;
  };

  if (!email || !password || !fullName) {
    throw new HttpsError('invalid-argument', 'email, password, and fullName are required.');
  }

  // 1. Create in Firebase Auth
  const userRecord = await auth.createUser({
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

  await db.collection(COLLECTIONS.users).doc(userRecord.uid).set(userData);

  await writeAuditLog(adminUser.uid, adminUser.displayName, 'user.create', 'user', userRecord.uid, { email });

  return { success: true, userId: userRecord.uid };
});

export const editUser = onCall({ region: 'asia-southeast1' }, async (request) => {
  const adminUser = await verifyAdmin(request);

  const { userId, email, fullName, phone, avatarUrl } = request.data as {
    userId?: string;
    email?: string;
    fullName?: string;
    phone?: string;
    avatarUrl?: string;
  };

  if (!userId) throw new HttpsError('invalid-argument', 'userId is required.');

  const userRef = db.collection(COLLECTIONS.users).doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found in Firestore.');

  // 1. Update in Firebase Auth
  const authUpdates: any = {};
  if (email !== undefined) authUpdates.email = email;
  if (fullName !== undefined) authUpdates.displayName = fullName;
  if (phone !== undefined) authUpdates.phoneNumber = phone || null;
  if (avatarUrl !== undefined) authUpdates.photoURL = avatarUrl || null;

  await auth.updateUser(userId, authUpdates).catch((err) => {
    throw new HttpsError('internal', 'Auth update failed: ' + err.message);
  });

  // 2. Update in Firestore users collection
  const firestoreUpdates: any = { updated_at: new Date() };
  if (email !== undefined) firestoreUpdates.email = email;
  if (fullName !== undefined) firestoreUpdates.full_name = fullName;
  if (phone !== undefined) firestoreUpdates.phone = phone || null;
  if (avatarUrl !== undefined) firestoreUpdates.avatar_url = avatarUrl || null;

  await userRef.update(firestoreUpdates);

  await writeAuditLog(adminUser.uid, adminUser.displayName, 'user.edit', 'user', userId, { email });

  return { success: true };
});

export const deleteUser = onCall({ region: 'asia-southeast1' }, async (request) => {
  const adminUser = await verifyAdmin(request);

  const { userId } = request.data as { userId?: string };
  if (!userId) throw new HttpsError('invalid-argument', 'userId is required.');

  // 1. Delete from Firebase Auth
  await auth.deleteUser(userId).catch((err) => {
    // If user is already deleted from Auth, we can still proceed to delete from Firestore
    console.warn('Auth user deletion warning: ' + err.message);
  });

  // 2. Delete from Firestore users collection
  await db.collection(COLLECTIONS.users).doc(userId).delete();

  await writeAuditLog(adminUser.uid, adminUser.displayName, 'user.delete', 'user', userId, {});

  return { success: true };
});
