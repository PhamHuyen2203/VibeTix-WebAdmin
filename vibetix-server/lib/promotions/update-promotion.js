"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePromotion = void 0;
const https_1 = require("firebase-functions/v2/https");
const assert_admin_1 = require("../common/assert-admin");
const audit_log_1 = require("../common/audit-log");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.updatePromotion = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, assert_admin_1.assertAdmin)(request);
    const { promoId, ...updates } = request.data;
    if (!promoId || typeof promoId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'promoId is required.');
    }
    const ref = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.discounts).doc(promoId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'Promotion code not found.');
    }
    const currentData = snap.data();
    const fieldsToUpdate = {};
    if (updates.value !== undefined) {
        if (typeof updates.value !== 'number' || updates.value <= 0) {
            throw new https_1.HttpsError('invalid-argument', 'Value must be greater than 0.');
        }
        if (currentData['type'] === 'percentage' && updates.value > 100) {
            throw new https_1.HttpsError('invalid-argument', 'Percentage value cannot exceed 100.');
        }
        fieldsToUpdate['value'] = updates.value;
    }
    if (updates.minOrderAmount !== undefined) {
        if (typeof updates.minOrderAmount !== 'number' || updates.minOrderAmount < 0) {
            throw new https_1.HttpsError('invalid-argument', 'Min order amount must be a positive number.');
        }
        fieldsToUpdate['minOrderAmount'] = updates.minOrderAmount;
    }
    if (updates.maxUses !== undefined) {
        if (typeof updates.maxUses !== 'number' || updates.maxUses <= 0) {
            throw new https_1.HttpsError('invalid-argument', 'Max uses must be greater than 0.');
        }
        fieldsToUpdate['maxUses'] = updates.maxUses;
    }
    if (updates.expiresAt !== undefined) {
        const expiresDate = new Date(updates.expiresAt);
        if (isNaN(expiresDate.getTime())) {
            throw new https_1.HttpsError('invalid-argument', 'Invalid expiration date.');
        }
        fieldsToUpdate['expiresAt'] = expiresDate;
    }
    if (updates.status !== undefined) {
        if (updates.status !== 'active' && updates.status !== 'inactive') {
            throw new https_1.HttpsError('invalid-argument', 'Status must be active or inactive.');
        }
        fieldsToUpdate['status'] = updates.status;
    }
    if (Object.keys(fieldsToUpdate).length === 0) {
        return { success: true, message: 'No updates provided.' };
    }
    await ref.update(fieldsToUpdate);
    await (0, audit_log_1.writeAuditLog)(admin.uid, admin.displayName, 'promotion.update', 'promotion', promoId, { code: currentData['code'], updatedFields: Object.keys(fieldsToUpdate) });
    return { success: true };
});
//# sourceMappingURL=update-promotion.js.map