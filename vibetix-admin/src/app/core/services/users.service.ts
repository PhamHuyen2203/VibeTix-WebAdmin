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
    const organizersCol = collection(firebaseDb, COLLECTIONS.organizers);
    const [total, active, suspended, organizers] = await Promise.all([
      getCountFromServer(this.col),
      getCountFromServer(query(this.col, where('is_active', '==', true))),
      getCountFromServer(query(this.col, where('is_active', '==', false))),
      getCountFromServer(organizersCol), // approximate organizer users
    ]);
    this.totalCount.set(total.data().count);
    this.activeCount.set(active.data().count);
    this.suspendedCount.set(suspended.data().count);
    this.organizerCount.set(organizers.data().count);
  }

  async getUsers(params: UserQuery): Promise<PaginatedResult<UserProfile>> {
    const pageSize = params.pageSize ?? 10;
    // We order by created_at which is the real field in the DB
    let q = query(this.col, orderBy('created_at', 'desc'), limit(pageSize + 1));

    if (params.status) {
      if (params.status === 'active') {
        q = query(q, where('is_active', '==', true));
      } else if (params.status === 'suspended' || params.status === 'inactive') {
        q = query(q, where('is_active', '==', false));
      }
    }
    
    // Note: filtering by role='organizer' is hard without a specific 'role' field indexing.
    // We will skip strict role filtering for now to avoid composite index errors.

    if (params.cursor) {
      q = query(q, startAfter(params.cursor));
    }

    // Fetch completes orders to aggregate totalSpent & count
    const ordersCol = collection(firebaseDb, COLLECTIONS.orders);
    const [snap, ordersSnap] = await Promise.all([
      getDocs(q),
      getDocs(query(ordersCol, where('status', '==', 'completed'))),
    ]);

    const userOrderStats: Record<string, { totalOrders: number; totalSpent: number }> = {};
    ordersSnap.docs.forEach((doc) => {
      const data = doc.data();
      const userId = data['user_id'] || '';
      const amount = Number(data['total_amount'] || 0);
      if (userId) {
        if (!userOrderStats[userId]) {
          userOrderStats[userId] = { totalOrders: 0, totalSpent: 0 };
        }
        userOrderStats[userId].totalOrders += 1;
        userOrderStats[userId].totalSpent += amount;
      }
    });

    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map((d) => {
      const uDoc = this.mapUserDoc(d.id, d.data());
      const stats = userOrderStats[uDoc.uid] || { totalOrders: 0, totalSpent: 0 };
      uDoc.totalOrders = stats.totalOrders;
      uDoc.totalSpent = stats.totalSpent;
      return uDoc;
    });

    return {
      items,
      lastDoc: hasMore ? docs[pageSize - 1] : null,
      hasMore,
    };
  }

  async getUserById(uid: string): Promise<UserProfile | null> {
    // Need to query by user_id just in case document ID is different
    const q = query(this.col, where('user_id', '==', uid));
    const snap = await getDocs(q);
    if (snap.empty) {
        // Fallback to checking document ID
        const docSnap = await getDoc(doc(firebaseDb, COLLECTIONS.users, uid));
        if (!docSnap.exists()) return null;
        return this.mapUserDoc(docSnap.id, docSnap.data());
    }
    return this.mapUserDoc(snap.docs[0].id, snap.docs[0].data());
  }

  private mapUserDoc(id: string, data: DocumentData): UserProfile {
    return {
      uid: data['user_id'] || id,
      email: data['email'] || '',
      displayName: data['full_name'] || data['fullName'] || 'Unknown User',
      photoURL: data['avatar_url'] || data['avatarUrl'],
      phoneNumber: data['phone'],
      role: (data['default_organizer_id'] || data['defaultOrganizerId']) ? 'organizer' : (data['role'] || 'customer'),
      status: data['is_active'] === false ? 'suspended' : 'active',
      createdAt: data['created_at'] || data['createdAt'] || new Date(),
      updatedAt: data['updated_at'] || data['updatedAt'],
      organizerId: data['default_organizer_id'] || data['defaultOrganizerId'],
    };
  }
}
