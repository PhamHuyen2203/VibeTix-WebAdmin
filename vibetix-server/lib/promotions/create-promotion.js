"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPromotion = void 0;
const https_1 = require("firebase-functions/v2/https");
const assert_admin_1 = require("../common/assert-admin");
const audit_log_1 = require("../common/audit-log");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.createPromotion = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, assert_admin_1.assertAdmin)(request);
    const data = request.data;
    // Validation
    if (!data.code || typeof data.code !== 'string' || data.code.trim().length < 3) {
        throw new https_1.HttpsError('invalid-argument', 'Code is required and must be at least 3 characters.');
    }
    const codeNormalized = data.code.trim().toUpperCase();
    if (data.type !== 'percentage' && data.type !== 'fixed') {
        throw new https_1.HttpsError('invalid-argument', 'Type must be percentage or fixed.');
    }
    if (typeof data.value !== 'number' || data.value <= 0) {
        throw new https_1.HttpsError('invalid-argument', 'Value must be greater than 0.');
    }
    if (data.type === 'percentage' && data.value > 100) {
        throw new https_1.HttpsError('invalid-argument', 'Percentage value cannot exceed 100.');
    }
    if (typeof data.maxUses !== 'number' || data.maxUses <= 0) {
        throw new https_1.HttpsError('invalid-argument', 'Max uses must be greater than 0.');
    }
    if (!data.expiresAt) {
        throw new https_1.HttpsError('invalid-argument', 'Expiration date is required.');
    }
    const expiresDate = new Date(data.expiresAt);
    if (isNaN(expiresDate.getTime())) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid expiration date.');
    }
    // Check if code already exists
    const existingSnap = await verifyAdmin_1.db
        .collection(verifyAdmin_1.COLLECTIONS.discounts)
        .where('code', '==', codeNormalized)
        .limit(1)
        .get();
    if (!existingSnap.empty) {
        throw new https_1.HttpsError('already-exists', `Promotion code "${codeNormalized}" already exists.`);
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
    const docRef = await verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.discounts).add(promoDoc);
    // Audit log
    await (0, audit_log_1.writeAuditLog)(admin.uid, admin.displayName, 'promotion.create', 'promotion', docRef.id, { code: codeNormalized, type: data.type, value: data.value });
    return { id: docRef.id, success: true };
});
//# sourceMappingURL=create-promotion.js.map