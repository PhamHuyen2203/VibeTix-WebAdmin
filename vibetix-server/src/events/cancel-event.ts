import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../common/assert-admin';
import { writeAuditLog } from '../common/audit-log';
import { db, COLLECTIONS } from '../auth/verifyAdmin';

export const cancelEvent = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const admin = await assertAdmin(request);

    const { eventId, reason } = request.data as { eventId?: string; reason?: string };
    if (!eventId || typeof eventId !== 'string') {
      throw new HttpsError('invalid-argument', 'eventId is required.');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      throw new HttpsError('invalid-argument', 'A cancellation reason of at least 5 characters is required.');
    }

    const ref = db.collection(COLLECTIONS.events).doc(eventId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Event not found.');
    }

    const prev = snap.data()!['status_str'];
    if (prev === 'cancelled') {
      throw new HttpsError('failed-precondition', 'Event is already cancelled.');
    }

    await ref.update({
      status_str: 'cancelled',
      cancellationReason: reason.trim(),
      cancelledAt: new Date(),
      cancelledBy: admin.uid,
    });

    await writeAuditLog(
      admin.uid,
      admin.displayName,
      'event.cancel',
      'event',
      eventId,
      { previousStatus: prev, reason: reason.trim() },
    );

    return { success: true };
  },
);
