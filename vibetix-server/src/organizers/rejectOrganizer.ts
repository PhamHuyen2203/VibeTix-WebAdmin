import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { verifyAdmin, writeAuditLog, db, COLLECTIONS } from '../auth/verifyAdmin';

export const rejectOrganizer = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const admin = await verifyAdmin(request);

    const { organizerId, reason } = request.data as { organizerId?: string; reason?: string };
    if (!organizerId) throw new HttpsError('invalid-argument', 'organizerId is required.');
    if (!reason || reason.trim().length < 5) {
      throw new HttpsError('invalid-argument', 'A rejection reason of at least 5 characters is required.');
    }

    const orgRef = db.collection(COLLECTIONS.organizers).doc(organizerId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) throw new HttpsError('not-found', 'Organizer not found.');

    const currentStatus = orgSnap.data()!['status'];
    if (currentStatus === 'rejected') throw new HttpsError('failed-precondition', 'Organizer is already rejected.');

    await orgRef.update({
      status: 'rejected',
      rejectionReason: reason.trim(),
      rejectedAt: new Date(),
      rejectedBy: admin.uid,
    });

    await writeAuditLog(admin.uid, admin.displayName, 'organizer.reject', 'organizer', organizerId, {
      previousStatus: currentStatus,
      reason: reason.trim(),
    });

    return { success: true };
  },
);
