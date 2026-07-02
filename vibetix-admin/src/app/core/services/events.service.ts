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
    const [total, pending, approved, cancelled] = await Promise.all([
      getCountFromServer(this.col),
      getCountFromServer(query(this.col, where('status', '==', 'pending_review'))),
      getCountFromServer(query(this.col, where('status', '==', 'approved'))),
      getCountFromServer(query(this.col, where('status', '==', 'cancelled'))),
    ]);
    this.totalCount.set(total.data().count);
    this.pendingCount.set(pending.data().count);
    this.approvedCount.set(approved.data().count);
    this.cancelledCount.set(cancelled.data().count);
  }

  async getEvents(params: EventQuery): Promise<PaginatedResult<EventDoc>> {
    const pageSize = params.pageSize ?? 10;
    let q = query(this.col, orderBy('createdAt', 'desc'), limit(pageSize + 1));

    if (params.status) {
      q = query(q, where('status', '==', params.status));
    }
    if (params.category) {
      q = query(q, where('category', '==', params.category));
    }
    if (params.organizerId) {
      q = query(q, where('organizerId', '==', params.organizerId));
    }
    if (params.cursor) {
      q = query(q, startAfter(params.cursor));
    }

    const snap = await getDocs(q);
    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map((d) => ({
      id: d.id,
      ...(d.data() as Omit<EventDoc, 'id'>),
    }));

    return { items, lastDoc: hasMore ? docs[pageSize - 1] : null, hasMore };
  }

  async getEventById(id: string): Promise<EventDoc | null> {
    const snap = await getDoc(doc(firebaseDb, COLLECTIONS.events, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<EventDoc, 'id'>) };
  }
}
