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
    const [pending, verified, suspended] = await Promise.all([
      getCountFromServer(query(this.col, where('status', '==', 'pending'))),
      getCountFromServer(query(this.col, where('status', '==', 'verified'))),
      getCountFromServer(query(this.col, where('status', '==', 'suspended'))),
    ]);
    this.pendingCount.set(pending.data().count);
    this.verifiedCount.set(verified.data().count);
    this.suspendedCount.set(suspended.data().count);
  }

  async getOrganizers(params: OrganizerQuery): Promise<PaginatedResult<OrganizerProfile>> {
    const pageSize = params.pageSize ?? 10;
    let q = query(this.col, orderBy('submittedAt', 'desc'), limit(pageSize + 1));

    if (params.status) {
      q = query(q, where('status', '==', params.status));
    }
    if (params.category) {
      q = query(q, where('category', '==', params.category));
    }
    if (params.cursor) {
      q = query(q, startAfter(params.cursor));
    }

    const snap = await getDocs(q);
    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map((d) => ({
      id: d.id,
      ...(d.data() as Omit<OrganizerProfile, 'id'>),
    }));

    return { items, lastDoc: hasMore ? docs[pageSize - 1] : null, hasMore };
  }

  async getOrganizerById(id: string): Promise<OrganizerProfile | null> {
    const snap = await getDoc(doc(firebaseDb, COLLECTIONS.organizers, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<OrganizerProfile, 'id'>) };
  }
}
