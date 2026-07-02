"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suspendOrganizer = void 0;
const https_1 = require("firebase-functions/v2/https");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.suspendOrganizer = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { organizerId, reason } = request.data;
    if (!organizerId)
        throw new https_1.HttpsError('invalid-argument', 'organizerId is required.');
    if (!reason)
        throw new https_1.HttpsError('invalid-argument', 'A suspension reason is required.');
    const orgRef = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.organizers).doc(organizerId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists)
        throw new https_1.HttpsError('not-found', 'Organizer not found.');
    const currentStatus = orgSnap.data()['status'];
    if (currentStatus === 'suspended')
        throw new https_1.HttpsError('failed-precondition', 'Organizer is already suspended.');
    await orgRef.update({ status: 'suspended', suspensionReason: reason, suspendedAt: new Date(), suspendedBy: admin.uid });
    await (0, verifyAdmin_1.writeAuditLog)(admin.uid, admin.displayName, 'organizer.suspend', 'organizer', organizerId, { previousStatus: currentStatus, reason });
    return { success: true };
});
//# sourceMappingURL=suspendOrganizer.js.map