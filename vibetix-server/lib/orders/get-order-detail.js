"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderDetail = void 0;
const https_1 = require("firebase-functions/v2/https");
const assert_admin_1 = require("../common/assert-admin");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.getOrderDetail = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    await (0, assert_admin_1.assertAdmin)(request);
    const { orderId } = request.data;
    if (!orderId || typeof orderId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'orderId is required.');
    }
    try {
        const orderSnap = await verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.orders).doc(orderId).get();
        if (!orderSnap.exists) {
            throw new https_1.HttpsError('not-found', 'Order not found.');
        }
        const orderData = orderSnap.data();
        // Retrieve tickets belonging to this order
        const ticketsSnap = await verifyAdmin_1.db
            .collection(verifyAdmin_1.COLLECTIONS.tickets)
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
        throw new https_1.HttpsError('internal', 'Failed to retrieve order details: ' + error.message);
    }
});
//# sourceMappingURL=get-order-detail.js.map