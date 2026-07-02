"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEvent = exports.editEvent = exports.createEvent = void 0;
const https_1 = require("firebase-functions/v2/https");
const verifyAdmin_1 = require("../auth/verifyAdmin");
exports.createEvent = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { title, description, organizerId, organizerName, categoryId, venueName, venueAddress, startTime, endTime, totalTickets } = request.data;
    if (!title || !organizerId) {
        throw new https_1.HttpsError('invalid-argument', 'title and organizerId are required.');
    }
    const newEventRef = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.events).doc();
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
    await (0, verifyAdmin_1.writeAuditLog)(admin.uid, admin.displayName, 'event.create', 'event', newEventRef.id, { title });
    return { success: true, eventId: newEventRef.id };
});
exports.editEvent = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { eventId, title, description, categoryId, venueName, venueAddress, startTime, endTime, totalTickets } = request.data;
    if (!eventId)
        throw new https_1.HttpsError('invalid-argument', 'eventId is required.');
    const eventRef = verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.events).doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists)
        throw new https_1.HttpsError('not-found', 'Event not found.');
    const updates = {};
    if (title !== undefined)
        updates.title = title;
    if (description !== undefined)
        updates.description = description;
    if (categoryId !== undefined)
        updates.category_id = categoryId;
    if (venueName !== undefined)
        updates.venue_name = venueName;
    if (venueAddress !== undefined)
        updates.venue_address = venueAddress;
    if (startTime !== undefined)
        updates.start_time = new Date(startTime);
    if (endTime !== undefined)
        updates.end_time = new Date(endTime);
    if (totalTickets !== undefined)
        updates.total_tickets = totalTickets;
    await eventRef.update(updates);
    await (0, verifyAdmin_1.writeAuditLog)(admin.uid, admin.displayName, 'event.edit', 'event', eventId, { title });
    return { success: true };
});
exports.deleteEvent = (0, https_1.onCall)({ region: 'asia-southeast1' }, async (request) => {
    const admin = await (0, verifyAdmin_1.verifyAdmin)(request);
    const { eventId } = request.data;
    if (!eventId)
        throw new https_1.HttpsError('invalid-argument', 'eventId is required.');
    await verifyAdmin_1.db.collection(verifyAdmin_1.COLLECTIONS.events).doc(eventId).delete();
    await (0, verifyAdmin_1.writeAuditLog)(admin.uid, admin.displayName, 'event.delete', 'event', eventId, {});
    return { success: true };
});
//# sourceMappingURL=eventCRUD.js.map