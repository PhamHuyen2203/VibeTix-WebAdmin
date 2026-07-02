"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPromotionActive = void 0;
const https_1 = require("firebase-functions/v2/https");
const assert_admin_1 = require("../common/assert-admin");
const audit_log_1 = require("../common/audit-log");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.setPromotionActive = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, assert_admin_1.assertAdmin)(request);
    const { promoId, active } = request.data;
    if (!promoId || typeof promoId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'promoId is required.');
    }
    if (typeof active !== 'boolean') {
        throw new https_1.HttpsError('invalid-argument', 'active parameter must be a boolean.');
    }
    const ref = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.discounts).doc(promoId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'Promotion code not found.');
    }
    const newStatus = active ? 'active' : 'inactive';
    const currentStatus = snap.data()['status'];
    await ref.update({ status: newStatus });
    await (0, audit_log_1.writeAuditLog)(admin.uid, admin.displayName, active ? 'promotion.enable' : 'promotion.disable', 'promotion', promoId, { previousStatus: currentStatus, code: snap.data()['code'] });
    return { success: true };
});
//# sourceMappingURL=set-promotion-active.js.map