import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../common/assert-admin';
import { writeAuditLog } from '../common/audit-log';
import { db, COLLECTIONS } from '../auth/verifyAdmin';

export const setPromotionActive = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const admin = await assertAdmin(request);

    const { promoId, active } = request.data as { promoId?: string; active?: boolean };
    if (!promoId || typeof promoId !== 'string') {
      throw new HttpsError('invalid-argument', 'promoId is required.');
    }
    if (typeof active !== 'boolean') {
      throw new HttpsError('invalid-argument', 'active parameter must be a boolean.');
    }

    const ref = db.collection(COLLECTIONS.discounts).doc(promoId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Promotion code not found.');
    }

    const newStatus = active ? 'active' : 'inactive';
    const currentStatus = snap.data()!['status'];

    await ref.update({ status: newStatus });

    await writeAuditLog(
      admin.uid,
      admin.displayName,
      active ? 'promotion.enable' : 'promotion.disable',
      'promotion',
      promoId,
      { previousStatus: currentStatus, code: snap.data()!['code'] },
    );

    return { success: true };
  },
);
