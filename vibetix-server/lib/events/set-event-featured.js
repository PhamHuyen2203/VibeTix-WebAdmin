"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setEventFeatured = exports.featureEvent = void 0;
const https_1 = require("firebase-functions/v2/https");
const assert_admin_1 = require("../common/assert-admin");
const audit_log_1 = require("../common/audit-log");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.featureEvent = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, assert_admin_1.assertAdmin)(request);
    const { eventId, featured } = request.data;
    if (!eventId || typeof eventId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'eventId is required.');
    }
    if (typeof featured !== 'boolean') {
        throw new https_1.HttpsError('invalid-argument', 'featured must be a boolean.');
    }
    const ref = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.events).doc(eventId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'Event not found.');
    }
    const prevFeatured = snap.data()['is_featured'] || false;
    await ref.update({
        is_featured: featured,
        featuredAt: featured ? new Date() : null,
        featuredBy: featured ? admin.uid : null,
    });
    await (0, audit_log_1.writeAuditLog)(admin.uid, admin.displayName, 'event.feature', 'event', eventId, { previousFeatured: prevFeatured, featured });
    return { success: true };
});
exports.setEventFeatured = exports.featureEvent;
//# sourceMappingURL=set-event-featured.js.map