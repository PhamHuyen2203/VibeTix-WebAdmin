"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardSummary = void 0;
const https_1 = require("firebase-functions/v2/https");
const assert_admin_1 = require("../common/assert-admin");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.getDashboardSummary = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    // 1. Verify caller is an active admin
    await (0, assert_admin_1.assertAdmin)(request);
    try {
        // 2. Query counts
        const usersSnap = await verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.users).count().get();
        const activeOrgsSnap = await verifyAdmin_1.db
            .collection(verifyAdmin_1.COLLECTIONS.organizers)
            .where('status', '==', 'verified')
            .count()
            .get();
        const pendingEventsSnap = await verifyAdmin_1.db
            .collection(verifyAdmin_1.COLLECTIONS.events)
            .where('status', '==', 'pending_review')
            .count()
            .get();
        // 3. Compute 30d stats from orders
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const ordersSnap = await verifyAdmin_1.db
            .collection(verifyAdmin_1.COLLECTIONS.orders)
            .where('status', '==', 'completed')
            .where('createdAt', '>=', thirtyDaysAgo)
            .get();
        let revenue30d = 0;
        let ticketsSold30d = 0;
        ordersSnap.forEach((doc) => {
            const data = doc.data();
            revenue30d += data['amount'] || 0;
            ticketsSold30d += data['totalTickets'] || 0;
        });
        // Compute refunded orders to calculate refund rate
        const refundedSnap = await verifyAdmin_1.db
            .collection(verifyAdmin_1.COLLECTIONS.orders)
            .where('status', '==', 'refunded')
            .where('createdAt', '>=', thirtyDaysAgo)
            .count()
            .get();
        const totalOrdersCount = ordersSnap.size + refundedSnap.data().count;
        const refundRate30d = totalOrdersCount > 0
            ? Math.round((refundedSnap.data().count / totalOrdersCount) * 10000) / 100
            : 0;
        return {
            totalUsers: usersSnap.data().count,
            activeOrganizers: activeOrgsSnap.data().count,
            pendingEvents: pendingEventsSnap.data().count,
            revenue30d,
            ticketsSold30d,
            refundRate30d,
        };
    }
    catch (error) {
        throw new https_1.HttpsError('internal', 'Failed to retrieve dashboard summary: ' + error.message);
    }
});
//# sourceMappingURL=get-dashboard-summary.js.map