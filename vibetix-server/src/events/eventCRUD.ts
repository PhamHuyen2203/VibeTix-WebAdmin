import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { verifyAdmin, writeAuditLog, db, COLLECTIONS } from '../auth/verifyAdmin';

export const createEvent = onCall({ region: 'asia-southeast1' }, async (request) => {
  const admin = await verifyAdmin(request);

  const { title, description, organizerId, organizerName, categoryId, venueName, venueAddress, startTime, endTime, totalTickets } = request.data as {
    title?: string;
    description?: string;
    organizerId?: string;
    organizerName?: string;
    categoryId?: string;
    venueName?: string;
    venueAddress?: string;
    startTime?: string;
    endTime?: string;
    totalTickets?: number;
  };

  if (!title || !organizerId) {
    throw new HttpsError('invalid-argument', 'title and organizerId are required.');
  }

  const newEventRef = db.collection(COLLECTIONS.events).doc();
  const eventData = {
    event_id: newEventRef.id,
    title,
    description: description || '',
    organizer_id: organizerId,
    organizer_name: organizerName || 'Organizer',
    category_id: categoryId || 'Concerts',
    venue_name: venueName || 'TBA',
    venue_address: venueAddress || 'TBA',
    status_str: 'pending',
    start_time: startTime ? new Date(startTime) : new Date(),
    end_time: endTime ? new Date(endTime) : new Date(),
    total_tickets: totalTickets || 100,
    tickets_sold: 0,
    revenue: 0,
    is_featured: false,
    created_at: new Date(),
  };

  await newEventRef.set(eventData);

  await writeAuditLog(admin.uid, admin.displayName, 'event.create', 'event', newEventRef.id, { title });

  return { success: true, eventId: newEventRef.id };
});

export const editEvent = onCall({ region: 'asia-southeast1' }, async (request) => {
  const admin = await verifyAdmin(request);

  const { eventId, title, description, categoryId, venueName, venueAddress, startTime, endTime, totalTickets } = request.data as {
    eventId?: string;
    title?: string;
    description?: string;
    categoryId?: string;
    venueName?: string;
    venueAddress?: string;
    startTime?: string;
    endTime?: string;
    totalTickets?: number;
  };

  if (!eventId) throw new HttpsError('invalid-argument', 'eventId is required.');

  const eventRef = db.collection(COLLECTIONS.events).doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) throw new HttpsError('not-found', 'Event not found.');

  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (categoryId !== undefined) updates.category_id = categoryId;
  if (venueName !== undefined) updates.venue_name = venueName;
  if (venueAddress !== undefined) updates.venue_address = venueAddress;
  if (startTime !== undefined) updates.start_time = new Date(startTime);
  if (endTime !== undefined) updates.end_time = new Date(endTime);
  if (totalTickets !== undefined) updates.total_tickets = totalTickets;

  await eventRef.update(updates);

  await writeAuditLog(admin.uid, admin.displayName, 'event.edit', 'event', eventId, { title });

  return { success: true };
});

export const deleteEvent = onCall({ region: 'asia-southeast1' }, async (request) => {
  const admin = await verifyAdmin(request);

  const { eventId } = request.data as { eventId?: string };
  if (!eventId) throw new HttpsError('invalid-argument', 'eventId is required.');

  await db.collection(COLLECTIONS.events).doc(eventId).delete();

  await writeAuditLog(admin.uid, admin.displayName, 'event.delete', 'event', eventId, {});

  return { success: true };
});
