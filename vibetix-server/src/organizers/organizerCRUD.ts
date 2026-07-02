import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { verifyAdmin, writeAuditLog, db, COLLECTIONS } from '../auth/verifyAdmin';

export const editOrganizer = onCall({ region: 'asia-southeast1' }, async (request) => {
  const admin = await verifyAdmin(request);

  const { organizerId, brandName, logoUrl, description, websiteUrl, contactEmail, contactPhone } = request.data as {
    organizerId?: string;
    brandName?: string;
    logoUrl?: string;
    description?: string;
    websiteUrl?: string;
    contactEmail?: string;
    contactPhone?: string;
  };

  if (!organizerId) throw new HttpsError('invalid-argument', 'organizerId is required.');

  const orgRef = db.collection(COLLECTIONS.organizers).doc(organizerId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) throw new HttpsError('not-found', 'Organizer not found.');

  const updates: any = {};
  if (brandName !== undefined) updates.brand_name = brandName;
  if (logoUrl !== undefined) updates.logo_url = logoUrl;
  if (description !== undefined) updates.description = description;
  if (websiteUrl !== undefined) updates.website_url = websiteUrl;
  if (contactEmail !== undefined) updates.contact_email = contactEmail;
  if (contactPhone !== undefined) updates.contact_phone = contactPhone;

  await orgRef.update(updates);

  await writeAuditLog(admin.uid, admin.displayName, 'organizer.edit', 'organizer', organizerId, { brandName });

  return { success: true };
});

export const deleteOrganizer = onCall({ region: 'asia-southeast1' }, async (request) => {
  const admin = await verifyAdmin(request);

  const { organizerId } = request.data as { organizerId?: string };
  if (!organizerId) throw new HttpsError('invalid-argument', 'organizerId is required.');

  await db.collection(COLLECTIONS.organizers).doc(organizerId).delete();

  await writeAuditLog(admin.uid, admin.displayName, 'organizer.delete', 'organizer', organizerId, {});

  return { success: true };
});

export const createOrganizer = onCall({ region: 'asia-southeast1' }, async (request) => {
  const admin = await verifyAdmin(request);

  const { brandName, contactEmail, contactPhone, description, websiteUrl, logoUrl, category } = request.data as {
    brandName?: string;
    contactEmail?: string;
    contactPhone?: string;
    description?: string;
    websiteUrl?: string;
    logoUrl?: string;
    category?: string;
  };

  if (!brandName || !contactEmail) {
    throw new HttpsError('invalid-argument', 'brandName and contactEmail are required.');
  }

  const newOrgRef = db.collection(COLLECTIONS.organizers).doc();
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

  await writeAuditLog(admin.uid, admin.displayName, 'organizer.create', 'organizer', newOrgRef.id, { brandName });

  return { success: true, organizerId: newOrgRef.id };
});
