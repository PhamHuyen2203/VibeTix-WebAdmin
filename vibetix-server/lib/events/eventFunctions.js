"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelEvent = exports.featureEvent = exports.rejectEvent = exports.approveEvent = void 0;
const https_1 = require("firebase-functions/v2/https");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.approveEvent = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { eventId } = request.data;
    if (!eventId)
        throw new https_1.HttpsError('invalid-argument', 'eventId is required.');
    const ref = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.events).doc(eventId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Event not found.');
    const prev = snap.data()['status'];
    if (prev === 'approved')
        throw new https_1.HttpsError('failed-precondition', 'Event is already approved.');
    await ref.update({ status: 'approved', approvedAt: new Date(), approvedBy: admin.uid, rejectionReason: null });
    await (0, verifyAdmin_1.writeAuditLog)(admin.uid, admin.displayName, 'event.approve', 'event', eventId, { previousStatus: prev });
    return { success: true };
});
exports.rejectEvent = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { eventId, reason } = request.data;
    if (!eventId)
        throw new https_1.HttpsError('invalid-argument', 'eventId is required.');
    if (!reason)
        throw new https_1.HttpsError('invalid-argument', 'A rejection reason is required.');
    const ref = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.events).doc(eventId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Event not found.');
    const prev = snap.data()['status'];
    await ref.update({ status: 'rejected', rejectionReason: reason, rejectedAt: new Date(), rejectedBy: admin.uid });
    await (0, verifyAdmin_1.writeAuditLog)(admin.uid, admin.displayName, 'event.reject', 'event', eventId, { previousStatus: prev, reason });
    return { success: true };
});
exports.featureEvent = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { eventId, featured } = request.data;
    if (!eventId)
        throw new https_1.HttpsError('invalid-argument', 'eventId is required.');
    if (typeof featured !== 'boolean')
        throw new https_1.HttpsError('invalid-argument', 'featured must be a boolean.');
    const ref = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.events).doc(eventId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Event not found.');
    const newStatus = featured ? 'featured' : 'approved';
    await ref.update({ featured, status: newStatus, featuredBy: admin.uid, featuredAt: new Date() });
    await (0, verifyAdmin_1.writeAuditLog)(admin.uid, admin.displayName, 'event.feature', 'event', eventId, { featured });
    return { success: true };
});
exports.cancelEvent = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { eventId, reason } = request.data;
    if (!eventId)
        throw new https_1.HttpsError('invalid-argument', 'eventId is required.');
    if (!reason)
        throw new https_1.HttpsError('invalid-argument', 'A cancellation reason is required.');
    const ref = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.events).doc(eventId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Event not found.');
    const prev = snap.data()['status'];
    if (prev === 'cancelled')
        throw new https_1.HttpsError('failed-precondition', 'Event is already cancelled.');
    await ref.update({ status: 'cancelled', cancellationReason: reason, cancelledAt: new Date(), cancelledBy: admin.uid });
    await (0, verifyAdmin_1.writeAuditLog)(admin.uid, admin.displayName, 'event.cancel', 'event', eventId, { previousStatus: prev, reason });
    return { success: true };
});
//# sourceMappingURL=eventFunctions.js.map