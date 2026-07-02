import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../common/assert-admin';
import { writeAuditLog } from '../common/audit-log';
import { db, COLLECTIONS } from '../auth/verifyAdmin';
export const requestRefund = onCall({ region: 'asia-southeast1' }, async (request) => {
    const admin = await assertAdmin(request);
    const { orderId, reason } = request.data;
    if (!orderId || typeof orderId !== 'string') {
        throw new HttpsError('invalid-argument', 'orderId is required.');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
        throw new HttpsError('invalid-argument', 'A refund reason of at least 5 characters is required.');
    }
    const orderRef = db.collection(COLLECTIONS.orders).doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
        throw new HttpsError('not-found', 'Order not found.');
    }
    const orderData = orderSnap.data();
    const currentStatus = orderData['status'];
    if (currentStatus !== 'completed') {
        throw new HttpsError('failed-precondition', 'Only completed orders can be refunded.');
    }
    const batch = db.batch();
    // 1. Update Order Status
    batch.update(orderRef, {
        status: 'refunded',
        refundReason: reason.trim(),
        refundedAt: new Date(),
        refundedBy: admin.uid,
    });
    // 2. Invalidate associated Tickets
    const ticketsSnap = await db
        .collection(COLLECTIONS.tickets)
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
    const paymentsSnap = await db
        .collection(COLLECTIONS.payments)
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
    await writeAuditLog(admin.uid, admin.displayName, 'order.refund', 'order', orderId, { amount: orderData['amount'], reason: reason.trim() });
    return { success: true };
});
//# sourceMappingURL=request-refund.js.map