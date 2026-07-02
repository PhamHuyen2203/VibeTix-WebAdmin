import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { verifyAdmin, writeAuditLog, db, COLLECTIONS } from '../auth/verifyAdmin';

export const approveOrganizer = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    // 1. Verify caller is an active admin
    const admin = await verifyAdmin(request);

    // 2. Validate payload
    const { organizerId } = request.data as { organizerId?: string };
    if (!organizerId || typeof organizerId !== 'string') {
      throw new HttpsError('invalid-argument', 'organizerId is required.');
    }

    // 3. Check organizer exists
    const orgRef = db.collection(COLLECTIONS.organizers).doc(organizerId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) {
      throw new HttpsError('not-found', 'Organizer not found.');
    }

    // 4. Enforce allowed state transition
    const isVerified = orgSnap.data()!['is_verified'] || false;
    if (isVerified) {
      throw new HttpsError('failed-precondition', 'Organizer is already verified.');
    }

    // 5. Apply the state change
    await orgRef.update({
      is_verified: true,
      verifiedAt: new Date(),
      verifiedBy: admin.uid,
      rejectionReason: null,
    });

    // 6. Write audit log
    await writeAuditLog(
      admin.uid,
      admin.displayName,
      'organizer.approve',
      'organizer',
      organizerId,
      { previousStatus: isVerified ? 'verified' : 'pending' },
    );

    // 7. Return typed response
    return { success: true };
  },
);
