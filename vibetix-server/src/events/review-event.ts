import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../common/assert-admin';
import { writeAuditLog } from '../common/audit-log';
import { db, COLLECTIONS } from '../auth/verifyAdmin';

export const approveEvent = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const admin = await assertAdmin(request);

    const { eventId } = request.data as { eventId?: string };
    if (!eventId || typeof eventId !== 'string') {
      throw new HttpsError('invalid-argument', 'eventId is required.');
    }

    const ref = db.collection(COLLECTIONS.events).doc(eventId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Event not found.');
    }

    const prev = snap.data()!['status'];
    if (prev === 'approved') {
      throw new HttpsError('failed-precondition', 'Event is already approved.');
    }

    await ref.update({
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: admin.uid,
      rejectionReason: null,
    });

    await writeAuditLog(
      admin.uid,
      admin.displayName,
      'event.approve',
      'event',
      eventId,
      { previousStatus: prev },
    );

    return { success: true };
  },
);

export const rejectEvent = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const admin = await assertAdmin(request);

    const { eventId, reason } = request.data as { eventId?: string; reason?: string };
    if (!eventId || typeof eventId !== 'string') {
      throw new HttpsError('invalid-argument', 'eventId is required.');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      throw new HttpsError('invalid-argument', 'A rejection reason of at least 5 characters is required.');
    }

    const ref = db.collection(COLLECTIONS.events).doc(eventId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Event not found.');
    }

    const prev = snap.data()!['status'];
    if (prev === 'rejected') {
      throw new HttpsError('failed-precondition', 'Event is already rejected.');
    }

    await ref.update({
      status: 'rejected',
      rejectionReason: reason.trim(),
      rejectedAt: new Date(),
      rejectedBy: admin.uid,
    });

    await writeAuditLog(
      admin.uid,
      admin.displayName,
      'event.reject',
      'event',
      eventId,
      { previousStatus: prev, reason: reason.trim() },
    );

    return { success: true };
  },
);
