"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = void 0;
const https_1 = require("firebase-functions/v2/https");
const assert_admin_1 = require("../common/assert-admin");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.listUsers = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    await (0, assert_admin_1.assertAdmin)(request);
    const { role, status, limit = 20, lastUid } = request.data;
    try {
        let query = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.users);
        if (role) {
            query = query.where('role', '==', role);
        }
        if (status) {
            query = query.where('status', '==', status);
        }
        query = query.orderBy('createdAt', 'desc');
        if (lastUid) {
            const lastDoc = await verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.users).doc(lastUid).get();
            if (lastDoc.exists) {
                query = query.startAfter(lastDoc);
            }
        }
        const snap = await query.limit(limit).get();
        const users = [];
        snap.forEach((doc) => {
            users.push({ uid: doc.id, ...doc.data() });
        });
        return {
            users,
            hasMore: users.length === limit,
        };
    }
    catch (error) {
        throw new https_1.HttpsError('internal', 'Failed to list users: ' + error.message);
    }
});
//# sourceMappingURL=list-users.js.map