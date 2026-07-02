import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../common/assert-admin';
import { writeAuditLog } from '../common/audit-log';
import { db, COLLECTIONS } from '../auth/verifyAdmin';
export const featureEvent = onCall({ region: 'asia-southeast1' }, async (request) => {
    const admin = await assertAdmin(request);
    const { eventId, featured } = request.data;
    if (!eventId || typeof eventId !== 'string') {
        throw new HttpsError('invalid-argument', 'eventId is required.');
    }
    if (typeof featured !== 'boolean') {
        throw new HttpsError('invalid-argument', 'featured must be a boolean.');
    }
    const ref = db.collection(COLLECTIONS.events).doc(eventId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new HttpsError('not-found', 'Event not found.');
    }
    const prevFeatured = snap.data()['featured'] || false;
    const prevStatus = snap.data()['status'];
    const newStatus = featured ? 'featured' : (prevStatus === 'featured' ? 'approved' : prevStatus);
    await ref.update({
        featured,
        status: newStatus,
        featuredAt: featured ? new Date() : null,
        featuredBy: featured ? admin.uid : null,
    });
    await writeAuditLog(admin.uid, admin.displayName, 'event.feature', 'event', eventId, { previousFeatured: prevFeatured, featured, newStatus });
    return { success: true };
});
export { featureEvent as setEventFeatured };
//# sourceMappingURL=set-event-featured.js.map