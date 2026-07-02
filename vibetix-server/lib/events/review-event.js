"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectEvent = exports.approveEvent = void 0;
const https_1 = require("firebase-functions/v2/https");
const assert_admin_1 = require("../common/assert-admin");
const audit_log_1 = require("../common/audit-log");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.approveEvent = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, assert_admin_1.assertAdmin)(request);
    const { eventId } = request.data;
    if (!eventId || typeof eventId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'eventId is required.');
    }
    const ref = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.events).doc(eventId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'Event not found.');
    }
    const prev = snap.data()['status'];
    if (prev === 'approved') {
        throw new https_1.HttpsError('failed-precondition', 'Event is already approved.');
    }
    await ref.update({
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: admin.uid,
        rejectionReason: null,
    });
    await (0, audit_log_1.writeAuditLog)(admin.uid, admin.displayName, 'event.approve', 'event', eventId, { previousStatus: prev });
    return { success: true };
});
exports.rejectEvent = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, assert_admin_1.assertAdmin)(request);
    const { eventId, reason } = request.data;
    if (!eventId || typeof eventId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'eventId is required.');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
        throw new https_1.HttpsError('invalid-argument', 'A rejection reason of at least 5 characters is required.');
    }
    const ref = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.events).doc(eventId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new https_1.HttpsError('not-found', 'Event not found.');
    }
    const prev = snap.data()['status'];
    if (prev === 'rejected') {
        throw new https_1.HttpsError('failed-precondition', 'Event is already rejected.');
    }
    await ref.update({
        status: 'rejected',
        rejectionReason: reason.trim(),
        rejectedAt: new Date(),
        rejectedBy: admin.uid,
    });
    await (0, audit_log_1.writeAuditLog)(admin.uid, admin.displayName, 'event.reject', 'event', eventId, { previousStatus: prev, reason: reason.trim() });
    return { success: true };
});
//# sourceMappingURL=review-event.js.map