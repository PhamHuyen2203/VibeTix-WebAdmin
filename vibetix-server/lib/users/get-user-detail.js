"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserDetail = void 0;
const https_1 = require("firebase-functions/v2/https");
const assert_admin_1 = require("../common/assert-admin");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.getUserDetail = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    await (0, assert_admin_1.assertAdmin)(request);
    const { userId } = request.data;
    if (!userId || typeof userId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'userId is required.');
    }
    try {
        // 1. Fetch User profile
        const userSnap = await verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.users).doc(userId).get();
        if (!userSnap.exists) {
            throw new https_1.HttpsError('not-found', 'User not found.');
        }
        // 2. Fetch User orders (recent 10 orders)
        const ordersSnap = await verifyAdmin_1.db
            .collection(verifyAdmin_1.COLLECTIONS.orders)
            .where('customerId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
        const orders = [];
        ordersSnap.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        return {
            user: { uid: userSnap.id, ...userSnap.data() },
            orders,
        };
    }
    catch (error) {
        throw new https_1.HttpsError('internal', 'Failed to retrieve user details: ' + error.message);
    }
});
//# sourceMappingURL=get-user-detail.js.map