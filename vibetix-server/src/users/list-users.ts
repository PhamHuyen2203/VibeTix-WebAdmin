import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../common/assert-admin';
import { admin, db, COLLECTIONS } from '../auth/verifyAdmin';

export const listUsers = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    await assertAdmin(request);

    const { role, status, limit = 20, lastUid } = request.data as {
      role?: string;
      status?: string;
      limit?: number;
      lastUid?: string;
    };

    try {
      let query: admin.firestore.Query = db.collection(COLLECTIONS.users);

      if (role) {
        query = query.where('role', '==', role);
      }
      if (status) {
        query = query.where('status', '==', status);
      }

      query = query.orderBy('createdAt', 'desc');

      if (lastUid) {
        const lastDoc = await db.collection(COLLECTIONS.users).doc(lastUid).get();
        if (lastDoc.exists) {
          query = query.startAfter(lastDoc);
        }
      }

      const snap = await query.limit(limit).get();
      const users: Record<string, unknown>[] = [];
      snap.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
        users.push({ uid: doc.id, ...doc.data() });
      });

      return {
        users,
        hasMore: users.length === limit,
      };
    } catch (error) {
      throw new HttpsError('internal', 'Failed to list users: ' + (error as Error).message);
    }
  },
);
