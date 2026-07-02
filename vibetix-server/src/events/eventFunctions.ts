import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { verifyAdmin, writeAuditLog, db, COLLECTIONS } from '../auth/verifyAdmin';

export const approveEvent = onCall({ region: 'asia-southeast1' }, async (request) => {
  const admin = await verifyAdmin(request);
  const { eventId } = request.data as { eventId?: string };
  if (!eventId) throw new HttpsError('invalid-argument', 'eventId is required.');

  const ref = db.collection(COLLECTIONS.events).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Event not found.');

  const prev = snap.data()!['status'];
  if (prev === 'approved') throw new HttpsError('failed-precondition', 'Event is already approved.');

  await ref.update({ status: 'approved', approvedAt: new Date(), approvedBy: admin.uid, rejectionReason: null });
  await writeAuditLog(admin.uid, admin.displayName, 'event.approve', 'event', eventId, { previousStatus: prev });
  return { success: true };
});

export const rejectEvent = onCall({ region: 'asia-southeast1' }, async (request) => {
  const admin = await verifyAdmin(request);
  const { eventId, reason } = request.data as { eventId?: string; reason?: string };
  if (!eventId) throw new HttpsError('invalid-argument', 'eventId is required.');
  if (!reason) throw new HttpsError('invalid-argument', 'A rejection reason is required.');

  const ref = db.collection(COLLECTIONS.events).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Event not found.');

  const prev = snap.data()!['status'];
  await ref.update({ status: 'rejected', rejectionReason: reason, rejectedAt: new Date(), rejectedBy: admin.uid });
  await writeAuditLog(admin.uid, admin.displayName, 'event.reject', 'event', eventId, { previousStatus: prev, reason });
  return { success: true };
});

export const featureEvent = onCall({ region: 'asia-southeast1' }, async (request) => {
  const admin = await verifyAdmin(request);
  const { eventId, featured } = request.data as { eventId?: string; featured?: boolean };
  if (!eventId) throw new HttpsError('invalid-argument', 'eventId is required.');
  if (typeof featured !== 'boolean') throw new HttpsError('invalid-argument', 'featured must be a boolean.');

  const ref = db.collection(COLLECTIONS.events).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Event not found.');

  const newStatus = featured ? 'featured' : 'approved';
  await ref.update({ featured, status: newStatus, featuredBy: admin.uid, featuredAt: new Date() });
  await writeAuditLog(admin.uid, admin.displayName, 'event.feature', 'event', eventId, { featured });
  return { success: true };
});

export const cancelEvent = onCall({ region: 'asia-southeast1' }, async (request) => {
  const admin = await verifyAdmin(request);
  const { eventId, reason } = request.data as { eventId?: string; reason?: string };
  if (!eventId) throw new HttpsError('invalid-argument', 'eventId is required.');
  if (!reason) throw new HttpsError('invalid-argument', 'A cancellation reason is required.');

  const ref = db.collection(COLLECTIONS.events).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Event not found.');

  const prev = snap.data()!['status'];
  if (prev === 'cancelled') throw new HttpsError('failed-precondition', 'Event is already cancelled.');

  await ref.update({ status: 'cancelled', cancellationReason: reason, cancelledAt: new Date(), cancelledBy: admin.uid });
  await writeAuditLog(admin.uid, admin.displayName, 'event.cancel', 'event', eventId, { previousStatus: prev, reason });
  return { success: true };
});
