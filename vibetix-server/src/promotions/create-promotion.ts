import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../common/assert-admin';
import { writeAuditLog } from '../common/audit-log';
import { db, COLLECTIONS } from '../auth/verifyAdmin';

export const createPromotion = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    const admin = await assertAdmin(request);

    const data = request.data as {
      code?: string;
      type?: 'percentage' | 'fixed';
      value?: number;
      eventId?: string | null;
      eventName?: string | null;
      minOrderAmount?: number;
      maxUses?: number;
      expiresAt?: string | number | Date;
    };

    // Validation
    if (!data.code || typeof data.code !== 'string' || data.code.trim().length < 3) {
      throw new HttpsError('invalid-argument', 'Code is required and must be at least 3 characters.');
    }
    const codeNormalized = data.code.trim().toUpperCase();

    if (data.type !== 'percentage' && data.type !== 'fixed') {
      throw new HttpsError('invalid-argument', 'Type must be percentage or fixed.');
    }

    if (typeof data.value !== 'number' || data.value <= 0) {
      throw new HttpsError('invalid-argument', 'Value must be greater than 0.');
    }
    if (data.type === 'percentage' && data.value > 100) {
      throw new HttpsError('invalid-argument', 'Percentage value cannot exceed 100.');
    }

    if (typeof data.maxUses !== 'number' || data.maxUses <= 0) {
      throw new HttpsError('invalid-argument', 'Max uses must be greater than 0.');
    }

    if (!data.expiresAt) {
      throw new HttpsError('invalid-argument', 'Expiration date is required.');
    }
    const expiresDate = new Date(data.expiresAt);
    if (isNaN(expiresDate.getTime())) {
      throw new HttpsError('invalid-argument', 'Invalid expiration date.');
    }

    // Check if code already exists
    const existingSnap = await db
      .collection(COLLECTIONS.discounts)
      .where('code', '==', codeNormalized)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      throw new HttpsError('already-exists', `Promotion code "${codeNormalized}" already exists.`);
    }

    // Insert document
    const promoDoc = {
      code: codeNormalized,
      type: data.type,
      value: data.value,
      eventId: data.eventId || null,
      eventName: data.eventName || null,
      minOrderAmount: data.minOrderAmount || 0,
      maxUses: data.maxUses,
      usedCount: 0,
      expiresAt: expiresDate,
      status: 'active',
      createdBy: admin.uid,
      createdAt: new Date(),
    };

    const docRef = await db.collection(COLLECTIONS.discounts).add(promoDoc);

    // Audit log
    await writeAuditLog(
      admin.uid,
      admin.displayName,
      'promotion.create',
      'promotion',
      docRef.id,
      { code: codeNormalized, type: data.type, value: data.value },
    );

    return { id: docRef.id, success: true };
  },
);
