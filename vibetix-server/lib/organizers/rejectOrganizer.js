"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectOrganizer = void 0;
const https_1 = require("firebase-functions/v2/https");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.rejectOrganizer = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { organizerId, reason } = request.data;
    if (!organizerId)
        throw new https_1.HttpsError('invalid-argument', 'organizerId is required.');
    if (!reason || reason.trim().length < 5) {
        throw new https_1.HttpsError('invalid-argument', 'A rejection reason of at least 5 characters is required.');
    }
    const orgRef = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.organizers).doc(organizerId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists)
        throw new https_1.HttpsError('not-found', 'Organizer not found.');
    const currentStatus = orgSnap.data()['status'];
    if (currentStatus === 'rejected')
        throw new https_1.HttpsError('failed-precondition', 'Organizer is already rejected.');
    await orgRef.update({
        status: 'rejected',
        rejectionReason: reason.trim(),
        rejectedAt: new Date(),
        rejectedBy: admin.uid,
    });
    await (0, verifyAdmin_1.writeAuditLog)(admin.uid, admin.displayName, 'organizer.reject', 'organizer', organizerId, {
        previousStatus: currentStatus,
        reason: reason.trim(),
    });
    return { success: true };
});
//# sourceMappingURL=rejectOrganizer.js.map