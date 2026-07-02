import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../common/assert-admin';
import { db, COLLECTIONS } from '../auth/verifyAdmin';
export const getOrderDetail = onCall({ region: 'asia-southeast1' }, async (request) => {
    await assertAdmin(request);
    const { orderId } = request.data;
    if (!orderId || typeof orderId !== 'string') {
        throw new HttpsError('invalid-argument', 'orderId is required.');
    }
    try {
        const orderSnap = await db.collection(COLLECTIONS.orders).doc(orderId).get();
        if (!orderSnap.exists) {
            throw new HttpsError('not-found', 'Order not found.');
        }
        const orderData = orderSnap.data();
        // Retrieve tickets belonging to this order
        const ticketsSnap = await db
            .collection(COLLECTIONS.tickets)
            .where('orderId', '==', orderId)
            .get();
        const tickets = [];
        ticketsSnap.forEach((doc) => {
            tickets.push({ id: doc.id, ...doc.data() });
        });
        return {
            order: { id: orderSnap.id, ...orderData },
            tickets,
        };
    }
    catch (error) {
        throw new HttpsError('internal', 'Failed to retrieve order details: ' + error.message);
    }
});
//# sourceMappingURL=get-order-detail.js.map