import { Injectable, signal } from '@angular/core';
import {
  collection,
  collectionGroup,
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
import { UserProfile, UserStatus } from '../models/user.model';

export interface UserQuery {
  searchTerm?: string;
  role?: string;
  status?: UserStatus | '';
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData>;
}

export interface PaginatedResult<T> {
  items: T[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  totalCount = signal(0);
  activeCount = signal(0);
  suspendedCount = signal(0);
  organizerCount = signal(0);

  private col = collection(firebaseDb, COLLECTIONS.users);

  async loadCounts(): Promise<void> {
    const [total, active, suspended, organizers] = await Promise.all([
      getCountFromServer(this.col),
      getCountFromServer(query(this.col, where('status', '==', 'active'))),
      getCountFromServer(query(this.col, where('status', '==', 'suspended'))),
      getCountFromServer(query(this.col, where('role', '==', 'organizer'))),
    ]);
    this.totalCount.set(total.data().count);
    this.activeCount.set(active.data().count);
    this.suspendedCount.set(suspended.data().count);
    this.organizerCount.set(organizers.data().count);
  }

  async getUsers(params: UserQuery): Promise<PaginatedResult<UserProfile>> {
    const pageSize = params.pageSize ?? 10;
    let q = query(this.col, orderBy('createdAt', 'desc'), limit(pageSize + 1));

    if (params.status) {
      q = query(q, where('status', '==', params.status));
    }
    if (params.role) {
      q = query(q, where('role', '==', params.role));
    }
    if (params.cursor) {
      q = query(q, startAfter(params.cursor));
    }

    const snap = await getDocs(q);
    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map((d) => ({
      uid: d.id,
      ...(d.data() as Omit<UserProfile, 'uid'>),
    }));

    return {
      items,
      lastDoc: hasMore ? docs[pageSize - 1] : null,
      hasMore,
    };
  }

  async getUserById(uid: string): Promise<UserProfile | null> {
    const snap = await getDoc(doc(firebaseDb, COLLECTIONS.users, uid));
    if (!snap.exists()) return null;
    return { uid: snap.id, ...(snap.data() as Omit<UserProfile, 'uid'>) };
  }
}
