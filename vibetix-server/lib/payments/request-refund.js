"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestRefund = void 0;
const https_1 = require("firebase-functions/v2/https");
const assert_admin_1 = require("../common/assert-admin");
const audit_log_1 = require("../common/audit-log");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.requestRefund = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, assert_admin_1.assertAdmin)(request);
    const { orderId, reason } = request.data;
    if (!orderId || typeof orderId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'orderId is required.');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
        throw new https_1.HttpsError('invalid-argument', 'A refund reason of at least 5 characters is required.');
    }
    const orderRef = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.orders).doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Order not found.');
    }
    const orderData = orderSnap.data();
    const currentStatus = orderData['status'];
    if (currentStatus !== 'completed') {
        throw new https_1.HttpsError('failed-precondition', 'Only completed orders can be refunded.');
    }
    const batch = verifyAdmin_1.db.batch();
    // 1. Update Order Status
    batch.update(orderRef, {
        status: 'refunded',
        refundReason: reason.trim(),
        refundedAt: new Date(),
        refundedBy: admin.uid,
    });
    // 2. Invalidate associated Tickets
    const ticketsSnap = await verifyAdmin_1.db
        .collection(verifyAdmin_1.COLLECTIONS.tickets)
        .where('orderId', '==', orderId)
        .get();
    ticketsSnap.forEach((doc) => {
        batch.update(doc.ref, {
            status: 'refunded',
            isValid: false,
            invalidatedAt: new Date(),
            invalidatedBy: admin.uid,
        });
    });
    // 3. Update Payment document status if it exists
    const paymentsSnap = await verifyAdmin_1.db
        .collection(verifyAdmin_1.COLLECTIONS.payments)
        .where('orderId', '==', orderId)
        .limit(1)
        .get();
    paymentsSnap.forEach((doc) => {
        batch.update(doc.ref, {
            status: 'refunded',
            refundedAt: new Date(),
            refundReason: reason.trim(),
        });
    });
    // Commit batch transaction
    await batch.commit();
    // Write Audit Log
    await (0, audit_log_1.writeAuditLog)(admin.uid, admin.displayName, 'order.refund', 'order', orderId, { amount: orderData['amount'], reason: reason.trim() });
    return { success: true };
});
//# sourceMappingURL=request-refund.js.map