import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../common/assert-admin';
import { writeAuditLog } from '../common/audit-log';
import { db, COLLECTIONS } from '../auth/verifyAdmin';
export const updatePromotion = onCall({ region: 'asia-southeast1' }, async (request) => {
    const admin = await assertAdmin(request);
    const { promoId, ...updates } = request.data;
    if (!promoId || typeof promoId !== 'string') {
        throw new HttpsError('invalid-argument', 'promoId is required.');
    }
    const ref = db.collection(COLLECTIONS.discounts).doc(promoId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new HttpsError('not-found', 'Promotion code not found.');
    }
    const currentData = snap.data();
    const fieldsToUpdate = {};
    if (updates.value !== undefined) {
        if (typeof updates.value !== 'number' || updates.value <= 0) {
            throw new HttpsError('invalid-argument', 'Value must be greater than 0.');
        }
        if (currentData['type'] === 'percentage' && updates.value > 100) {
            throw new HttpsError('invalid-argument', 'Percentage value cannot exceed 100.');
        }
        fieldsToUpdate['value'] = updates.value;
    }
    if (updates.minOrderAmount !== undefined) {
        if (typeof updates.minOrderAmount !== 'number' || updates.minOrderAmount < 0) {
            throw new HttpsError('invalid-argument', 'Min order amount must be a positive number.');
        }
        fieldsToUpdate['minOrderAmount'] = updates.minOrderAmount;
    }
    if (updates.maxUses !== undefined) {
        if (typeof updates.maxUses !== 'number' || updates.maxUses <= 0) {
            throw new HttpsError('invalid-argument', 'Max uses must be greater than 0.');
        }
        fieldsToUpdate['maxUses'] = updates.maxUses;
    }
    if (updates.expiresAt !== undefined) {
        const expiresDate = new Date(updates.expiresAt);
        if (isNaN(expiresDate.getTime())) {
            throw new HttpsError('invalid-argument', 'Invalid expiration date.');
        }
        fieldsToUpdate['expiresAt'] = expiresDate;
    }
    if (updates.status !== undefined) {
        if (updates.status !== 'active' && updates.status !== 'inactive') {
            throw new HttpsError('invalid-argument', 'Status must be active or inactive.');
        }
        fieldsToUpdate['status'] = updates.status;
    }
    if (Object.keys(fieldsToUpdate).length === 0) {
        return { success: true, message: 'No updates provided.' };
    }
    await ref.update(fieldsToUpdate);
    await writeAuditLog(admin.uid, admin.displayName, 'promotion.update', 'promotion', promoId, { code: currentData['code'], updatedFields: Object.keys(fieldsToUpdate) });
    return { success: true };
});
//# sourceMappingURL=update-promotion.js.map