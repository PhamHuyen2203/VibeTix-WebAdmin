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
    try {
      const allDocs = await getDocs(this.col);
      let pending = 0, verified = 0, suspended = 0;
      allDocs.docs.forEach(d => {
        const data = d.data();
        const isVerified = data['is_verified'] || false;
        const status = (data['status'] || '').toLowerCase();
        if (status === 'suspended') suspended++;
        else if (isVerified || status === 'verified') verified++;
        else pending++;
      });
      this.pendingCount.set(pending);
      this.verifiedCount.set(verified);
      this.suspendedCount.set(suspended);
    } catch(e) {
      console.warn('OrganizersService.loadCounts failed:', e);
    }
  }

  async getOrganizers(params: OrganizerQuery): Promise<PaginatedResult<OrganizerProfile>> {
    const pageSize = params.pageSize ?? 10;
    
    // Fetch organizers
    let snap;
    try {
      const q = query(this.col, orderBy('created_at', 'desc'), limit(pageSize + 1));
      snap = await getDocs(params.cursor ? query(q, startAfter(params.cursor)) : q);
    } catch(e) {
      snap = await getDocs(query(this.col, limit(pageSize + 1)));
    }

    // Fetch all events, orders, and order_items to aggregate eventsCount & revenue
    const eventsCol = collection(firebaseDb, COLLECTIONS.events);
    const ordersCol = collection(firebaseDb, COLLECTIONS.orders);
    const orderItemsCol = collection(firebaseDb, 'order_items');
    
    let eventsSnap, ordersSnap, orderItemsSnap;
    try {
      [eventsSnap, ordersSnap, orderItemsSnap] = await Promise.all([
        getDocs(eventsCol), 
        getDocs(ordersCol),
        getDocs(orderItemsCol)
      ]);
    } catch(e) {
      eventsSnap = { docs: [] };
      ordersSnap = { docs: [] };
      orderItemsSnap = { docs: [] };
    }

    // Map order_id -> status
    const orderStatusMap: Record<string, string> = {};
    (ordersSnap as any).docs.forEach((d: any) => {
      const data = d.data();
      const id = data['order_id'] || d.id;
      orderStatusMap[id] = (data['status'] || '').toLowerCase();
    });

    // Build event→organizer mapping using ALL possible ID fields
    const eventOrgMap: Record<string, string> = {};
    const organizerStats: Record<string, { eventsCount: number; totalRevenue: number }> = {};
    
    (eventsSnap as any).docs.forEach((d: any) => {
      const data = d.data();
      const orgId = data['organizer_id'] || data['organizerId'] || '';
      const eventIdField = data['event_id'] || '';
      const docId = d.id;
      
      if (orgId) {
        if (docId) eventOrgMap[docId] = orgId;
        if (eventIdField) eventOrgMap[eventIdField] = orgId;
        
        if (!organizerStats[orgId]) {
          organizerStats[orgId] = { eventsCount: 0, totalRevenue: 0 };
        }
        organizerStats[orgId].eventsCount += 1;
      }
    });

    // Sum revenue per organizer from order_items
    (orderItemsSnap as any).docs.forEach((d: any) => {
      const item = d.data();
      const orderId = item['order_id'] || '';
      const status = orderStatusMap[orderId];
      
      if (status !== 'completed' && status !== 'confirmed') return;
      
      const evId = item['event_id'] || '';
      if (!evId) return;

      const orgId = eventOrgMap[evId];
      if (!orgId) return;

      const qty = Number(item['quantity'] || 1);
      const price = Number(item['price_per_ticket'] || 0);
      const itemTotal = qty * price;

      if (!organizerStats[orgId]) {
        organizerStats[orgId] = { eventsCount: 0, totalRevenue: 0 };
      }
      organizerStats[orgId].totalRevenue += itemTotal;
    });

    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map((d) => {
      const org = this.mapOrganizerDoc(d.id, d.data());
      const stats = organizerStats[org.id] || { eventsCount: 0, totalRevenue: 0 };
      // Also check by Firestore doc ID in case org.id differs
      const statsByDocId = organizerStats[d.id] || { eventsCount: 0, totalRevenue: 0 };
      org.eventsCount = Math.max(stats.eventsCount, statsByDocId.eventsCount);
      org.revenue30d = Math.max(stats.totalRevenue, statsByDocId.totalRevenue);
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
