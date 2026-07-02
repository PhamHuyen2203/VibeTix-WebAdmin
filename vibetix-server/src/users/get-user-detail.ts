import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../common/assert-admin';
import { db, COLLECTIONS } from '../auth/verifyAdmin';

export const getUserDetail = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    await assertAdmin(request);

    const { userId } = request.data as { userId?: string };
    if (!userId || typeof userId !== 'string') {
      throw new HttpsError('invalid-argument', 'userId is required.');
    }

    try {
      // 1. Fetch User profile
      const userSnap = await db.collection(COLLECTIONS.users).doc(userId).get();
      if (!userSnap.exists) {
        throw new HttpsError('not-found', 'User not found.');
      }

      // 2. Fetch User orders (recent 10 orders)
      const ordersSnap = await db
        .collection(COLLECTIONS.orders)
        .where('customerId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      const orders: Record<string, unknown>[] = [];
      ordersSnap.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
      });

      return {
        user: { uid: userSnap.id, ...userSnap.data() },
        orders,
      };
    } catch (error) {
      throw new HttpsError('internal', 'Failed to retrieve user details: ' + (error as Error).message);
    }
  },
);
