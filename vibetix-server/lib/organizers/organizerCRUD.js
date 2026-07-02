"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrganizer = exports.deleteOrganizer = exports.editOrganizer = void 0;
const https_1 = require("firebase-functions/v2/https");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.editOrganizer = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { organizerId, brandName, logoUrl, description, websiteUrl, contactEmail, contactPhone } = request.data;
    if (!organizerId)
        throw new https_1.HttpsError('invalid-argument', 'organizerId is required.');
    const orgRef = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.organizers).doc(organizerId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists)
        throw new https_1.HttpsError('not-found', 'Organizer not found.');
    const updates = {};
    if (brandName !== undefined)
        updates.brand_name = brandName;
    if (logoUrl !== undefined)
        updates.logo_url = logoUrl;
    if (description !== undefined)
        updates.description = description;
    if (websiteUrl !== undefined)
        updates.website_url = websiteUrl;
    if (contactEmail !== undefined)
        updates.contact_email = contactEmail;
    if (contactPhone !== undefined)
        updates.contact_phone = contactPhone;
    await orgRef.update(updates);
    await (0, verifyAdmin_1.writeAuditLog)(admin.uid, admin.displayName, 'organizer.edit', 'organizer', organizerId, { brandName });
    return { success: true };
});
exports.deleteOrganizer = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { organizerId } = request.data;
    if (!organizerId)
        throw new https_1.HttpsError('invalid-argument', 'organizerId is required.');
    await verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.organizers).doc(organizerId).delete();
    await (0, verifyAdmin_1.writeAuditLog)(admin.uid, admin.displayName, 'organizer.delete', 'organizer', organizerId, {});
    return { success: true };
});
exports.createOrganizer = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { brandName, contactEmail, contactPhone, description, websiteUrl, logoUrl, category } = request.data;
    if (!brandName || !contactEmail) {
        throw new https_1.HttpsError('invalid-argument', 'brandName and contactEmail are required.');
    }
    const newOrgRef = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.organizers).doc();
    const orgData = {
        organizer_id: newOrgRef.id,
        user_id: admin.uid, // default owner is creator admin
        brand_name: brandName,
        logo_url: logoUrl || null,
        description: description || null,
        website_url: websiteUrl || null,
        contact_email: contactEmail,
        contact_phone: contactPhone || null,
        is_verified: true,
        category: category || 'Entertainment',
        created_at: new Date(),
    };
    await newOrgRef.set(orgData);
    await (0, verifyAdmin_1.writeAuditLog)(admin.uid, admin.displayName, 'organizer.create', 'organizer', newOrgRef.id, { brandName });
    return { success: true, organizerId: newOrgRef.id };
});
//# sourceMappingURL=organizerCRUD.js.map