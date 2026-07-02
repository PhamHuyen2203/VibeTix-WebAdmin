import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../common/assert-admin';
import { db, COLLECTIONS } from '../auth/verifyAdmin';

export const getDashboardSummary = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    // 1. Verify caller is an active admin
    await assertAdmin(request);

    try {
      // 2. Query counts
      const usersSnap = await db.collection(COLLECTIONS.users).count().get();
      const activeOrgsSnap = await db
        .collection(COLLECTIONS.organizers)
        .where('status', '==', 'verified')
        .count()
        .get();
      const pendingEventsSnap = await db
        .collection(COLLECTIONS.events)
        .where('status', '==', 'pending_review')
        .count()
        .get();

      // 3. Compute 30d stats from orders
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const ordersSnap = await db
        .collection(COLLECTIONS.orders)
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
      const refundedSnap = await db
        .collection(COLLECTIONS.orders)
        .where('status', '==', 'refunded')
        .where('createdAt', '>=', thirtyDaysAgo)
        .count()
        .get();

      const totalOrdersCount = ordersSnap.size + refundedSnap.data().count;
      const refundRate30d =
        totalOrdersCount > 0
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
    } catch (error) {
      throw new HttpsError('internal', 'Failed to retrieve dashboard summary: ' + (error as Error).message);
    }
  },
);
