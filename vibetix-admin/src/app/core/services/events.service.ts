import { Injectable, signal } from '@angular/core';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  getCountFromServer,
} from 'firebase/firestore';
import { firebaseDb } from '../firebase/firebase.client';
import { COLLECTIONS } from '../firebase/collections';
import { EventDoc, EventStatus } from '../models/event.model';
import { PaginatedResult } from './users.service';

export interface EventQuery {
  status?: EventStatus | '';
  category?: string;
  organizerId?: string;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData>;
}

@Injectable({ providedIn: 'root' })
export class EventsService {
  totalCount = signal(0);
  pendingCount = signal(0);
  approvedCount = signal(0);
  cancelledCount = signal(0);

  private col = collection(firebaseDb, COLLECTIONS.events);

  async loadCounts(): Promise<void> {
    try {
      const allDocs = await getDocs(this.col);
      let total = 0, pending = 0, approved = 0, cancelled = 0;
      allDocs.docs.forEach(d => {
        total++;
        const data = d.data();
        const status = (data['status_str'] || data['status'] || '').toLowerCase();
        if (status === 'pending' || status === 'pending_review') pending++;
        else if (status === 'approved' || status === 'ongoing' || status === 'completed') approved++;
        else if (status === 'cancelled') cancelled++;
      });
      this.totalCount.set(total);
      this.pendingCount.set(pending);
      this.approvedCount.set(approved);
      this.cancelledCount.set(cancelled);
    } catch(e) {
      console.warn('EventsService.loadCounts failed:', e);
    }
  }

  async getEvents(params: EventQuery): Promise<PaginatedResult<EventDoc>> {
    const pageSize = params.pageSize ?? 10;
    let q;
    try {
      q = query(this.col, orderBy('created_at', 'desc'), limit(pageSize + 1));
      if (params.cursor) {
        q = query(q, startAfter(params.cursor));
      }
    } catch(e) {
      q = query(this.col, limit(pageSize + 1));
    }

    let snap;
    try {
      snap = await getDocs(q);
    } catch(e) {
      // Fallback: no ordering
      snap = await getDocs(query(this.col, limit(pageSize + 1)));
    }
    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map((d) => this.mapEventDoc(d.id, d.data()));

    return { items, lastDoc: hasMore ? docs[pageSize - 1] : null, hasMore };
  }

  async getEventById(id: string): Promise<EventDoc | null> {
    // Also try finding by event_id in case document id differs
    let q = query(this.col, where('event_id', '==', id));
    let snap = await getDocs(q);
    if (!snap.empty) {
      return this.mapEventDoc(snap.docs[0].id, snap.docs[0].data());
    }

    const docSnap = await getDoc(doc(firebaseDb, COLLECTIONS.events, id));
    if (!docSnap.exists()) return null;
    return this.mapEventDoc(docSnap.id, docSnap.data());
  }

  private mapEventDoc(id: string, data: DocumentData): EventDoc {
    // IMPORTANT: Keep both firestore doc ID and event_id field for joins
    const eventId = data['event_id'] || id;
    return {
      id: eventId,
      organizerId: data['organizer_id'] || data['organizerId'] || '',
      organizerName: data['organizer_name'] || data['organizerName'] || 'Organizer',
      title: data['title'] || 'Untitled Event',
      description: data['description'] || '',
      category: data['category_id'] || data['categoryId'] || data['category'] || 'Unknown',
      venue: data['venue'] || data['venue_name'] || data['venueName'] || 'TBA',
      location: data['location'] || data['venue_address'] || data['venueAddress'] || data['address'] || 'TBA',
      status: this.mapStatus(data['status_str'] || data['status']),
      date: data['start_time'] || data['startTime'] || new Date(),
      endDate: data['end_time'] || data['endTime'] || new Date(),
      imageUrl: data['poster_url'] || data['posterUrl'] || data['banner_url'] || data['bannerUrl'],
      totalTickets: data['total_tickets'] || 0,
      ticketSold: data['tickets_sold'] || data['ticketsSold'] || 0,
      revenue: data['revenue'] || 0,
      schedule: [],
      pricing: [],
      documents: [],
      featured: data['is_featured'] || data['isFeatured'] || false,
      createdAt: data['created_at'] || data['createdAt'] || new Date(),
      _firestoreDocId: id,  // Keep original Firestore document ID for cross-referencing
    } as EventDoc;
  }

  private mapStatus(status: string): EventStatus {
    switch (status) {
      case 'pending': return 'pending_review';
      case 'approved': return 'approved';
      case 'ongoing': return 'approved'; // map ongoing to approved
      case 'completed': return 'approved'; // map completed to approved
      case 'cancelled': return 'cancelled';
      case 'rejected': return 'rejected';
      default: return 'pending_review';
    }
  }

  private mapReverseStatus(status: EventStatus): string {
    switch (status) {
      case 'pending_review': return 'pending';
      case 'approved': return 'approved';
      case 'featured': return 'approved'; // featured is not a status in Android App
      case 'cancelled': return 'cancelled';
      case 'rejected': return 'rejected';
      default: return 'pending';
    }
  }
}
