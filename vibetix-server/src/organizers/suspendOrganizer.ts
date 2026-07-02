import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { verifyAdmin, writeAuditLog, db, COLLECTIONS } from '../auth/verifyAdmin';

export const suspendOrganizer = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const admin = await verifyAdmin(request);

    const { organizerId, reason } = request.data as { organizerId?: string; reason?: string };
    if (!organizerId) throw new HttpsError('invalid-argument', 'organizerId is required.');
    if (!reason) throw new HttpsError('invalid-argument', 'A suspension reason is required.');

    const orgRef = db.collection(COLLECTIONS.organizers).doc(organizerId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) throw new HttpsError('not-found', 'Organizer not found.');

    const currentStatus = orgSnap.data()!['status'];
    if (currentStatus === 'suspended') throw new HttpsError('failed-precondition', 'Organizer is already suspended.');

    await orgRef.update({ status: 'suspended', suspensionReason: reason, suspendedAt: new Date(), suspendedBy: admin.uid });
    await writeAuditLog(admin.uid, admin.displayName, 'organizer.suspend', 'organizer', organizerId, { previousStatus: currentStatus, reason });

    return { success: true };
  },
);
