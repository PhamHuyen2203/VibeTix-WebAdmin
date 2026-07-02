"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveOrganizer = void 0;
const https_1 = require("firebase-functions/v2/https");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.approveOrganizer = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    // 1. Verify caller is an active admin
    const admin = await (0, verifyAdmin_1.verifyAdmin)(request);
    // 2. Validate payload
    const { organizerId } = request.data;
    if (!organizerId || typeof organizerId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'organizerId is required.');
    }
    // 3. Check organizer exists
    const orgRef = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.organizers).doc(organizerId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Organizer not found.');
    }
    // 4. Enforce allowed state transition
    const currentStatus = orgSnap.data()['status'];
    if (currentStatus === 'verified') {
        throw new https_1.HttpsError('failed-precondition', 'Organizer is already verified.');
    }
    // 5. Apply the state change
    await orgRef.update({
        status: 'verified',
        verifiedAt: new Date(),
        verifiedBy: admin.uid,
        rejectionReason: null,
    });
    // 6. Write audit log
    await (0, verifyAdmin_1.writeAuditLog)(admin.uid, admin.displayName, 'organizer.approve', 'organizer', organizerId, { previousStatus: currentStatus });
    // 7. Return typed response
    return { success: true };
});
//# sourceMappingURL=approveOrganizer.js.map