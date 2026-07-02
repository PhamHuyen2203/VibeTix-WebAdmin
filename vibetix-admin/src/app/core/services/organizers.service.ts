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
import { OrganizerProfile, OrganizerStatus } from '../models/organizer.model';
import { PaginatedResult } from './users.service';

export interface OrganizerQuery {
  searchTerm?: string;
  status?: OrganizerStatus | '';
  category?: string;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData>;
}

@Injectable({ providedIn: 'root' })
export class OrganizersService {
  pendingCount = signal(0);
  verifiedCount = signal(0);
  suspendedCount = signal(0);

  private col = collection(firebaseDb, COLLECTIONS.organizers);

  async loadCounts(): Promise<void> {
    const [pending, verified] = await Promise.all([
      getCountFromServer(query(this.col, where('is_verified', '==', false))),
      getCountFromServer(query(this.col, where('is_verified', '==', true))),
    ]);
    this.pendingCount.set(pending.data().count);
    this.verifiedCount.set(verified.data().count);
    this.suspendedCount.set(0); // no suspended state in db
  }

  async getOrganizers(params: OrganizerQuery): Promise<PaginatedResult<OrganizerProfile>> {
    const pageSize = params.pageSize ?? 10;
    let q = query(this.col, orderBy('created_at', 'desc'), limit(pageSize + 1));

    if (params.cursor) {
      q = query(q, startAfter(params.cursor));
    }

    // Fetch all events and orders to aggregate eventsCount & revenue for each organizer
    const eventsCol = collection(firebaseDb, COLLECTIONS.events);
    const ordersCol = collection(firebaseDb, COLLECTIONS.orders);
    const [snap, eventsSnap, ordersSnap] = await Promise.all([
      getDocs(q),
      getDocs(eventsCol),
      getDocs(ordersCol),
    ]);

    // Map event ID to organizer ID
    const eventOrgMap: Record<string, string> = {};
    eventsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const orgId = data['organizer_id'] || data['organizerId'] || '';
      const evId = data['event_id'] || doc.id;
      if (orgId && evId) {
        eventOrgMap[evId] = orgId;
      }
    });

    const organizerStats: Record<string, { eventsCount: number; totalRevenue: number }> = {};
    eventsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const orgId = data['organizer_id'] || data['organizerId'] || '';
      if (orgId) {
        if (!organizerStats[orgId]) {
          organizerStats[orgId] = { eventsCount: 0, totalRevenue: 0 };
        }
        organizerStats[orgId].eventsCount += 1;
      }
    });

    ordersSnap.docs.forEach((doc) => {
      const data = doc.data();
      const status = (data['status'] || '').toLowerCase();
      if (status !== 'completed') return;
      const evId = data['event_id'] || '';
      const orgId = eventOrgMap[evId];
      const amount = Number(data['total_amount'] || data['amount'] || 0);
      if (orgId) {
        if (!organizerStats[orgId]) {
          organizerStats[orgId] = { eventsCount: 0, totalRevenue: 0 };
        }
        organizerStats[orgId].totalRevenue += amount;
      }
    });

    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map((d) => {
      const org = this.mapOrganizerDoc(d.id, d.data());
      const stats = organizerStats[org.id] || { eventsCount: 0, totalRevenue: 0 };
      org.eventsCount = stats.eventsCount;
      org.revenue30d = stats.totalRevenue;
      return org;
    });

    return { items, lastDoc: hasMore ? docs[pageSize - 1] : null, hasMore };
  }

  async getOrganizerById(id: string): Promise<OrganizerProfile | null> {
    let q = query(this.col, where('organizer_id', '==', id));
    let snap = await getDocs(q);
    if (!snap.empty) {
      return this.mapOrganizerDoc(snap.docs[0].id, snap.docs[0].data());
    }

    const docSnap = await getDoc(doc(firebaseDb, COLLECTIONS.organizers, id));
    if (!docSnap.exists()) return null;
    return this.mapOrganizerDoc(docSnap.id, docSnap.data());
  }

  private mapOrganizerDoc(id: string, data: DocumentData): OrganizerProfile {
    const isVerified = data['is_verified'] || false;
    const documents = data['business_license_url'] ? [
      {
        name: 'Business License',
        fileName: 'business_license.pdf',
        url: data['business_license_url'],
        status: isVerified ? 'verified' : 'pending'
      }
    ] : [];

    return {
      id: data['organizer_id'] || id,
      uid: data['user_id'] || '',
      ownerName: data['ownerName'] || 'Organizer',
      businessName: data['brand_name'] || data['brandName'] || 'Unnamed',
      email: data['contact_email'] || data['contactEmail'] || '',
      phone: data['contact_phone'] || data['contactPhone'] || '',
      logoUrl: data['logo_url'] || data['logoUrl'] || '',
      category: data['category'] || 'Entertainment', 
      location: '',
      status: isVerified ? 'verified' : 'pending',
      documents,
      eventsCount: 0, 
      revenue30d: 0,
      submittedAt: data['created_at'] || data['createdAt'] || new Date(),
    } as OrganizerProfile;
  }
}
