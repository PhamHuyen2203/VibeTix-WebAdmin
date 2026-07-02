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
  updateDoc,
  QueryDocumentSnapshot,
  DocumentData,
  getCountFromServer,
} from 'firebase/firestore';
import { firebaseDb } from '../firebase/firebase.client';
import { COLLECTIONS } from '../firebase/collections';
import { OrderDoc, OrderStatus } from '../models/order.model';
import { PaginatedResult } from './users.service';

export interface OrderQuery {
  status?: OrderStatus | '';
  userId?: string;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData>;
}

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private col = collection(firebaseDb, COLLECTIONS.orders);

  async getOrders(params: OrderQuery): Promise<PaginatedResult<OrderDoc>> {
    const pageSize = params.pageSize ?? 10;
    let q = query(this.col, orderBy('order_date', 'desc'), limit(pageSize + 1));

    if (params.status) {
      q = query(q, where('status', '==', params.status.toLowerCase()));
    }
    if (params.userId) {
      q = query(q, where('user_id', '==', params.userId));
    }
    if (params.cursor) {
      q = query(q, startAfter(params.cursor));
    }

    const snap = await getDocs(q);
    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map((d) => this.mapOrderDoc(d.id, d.data()));

    return {
      items,
      lastDoc: hasMore ? docs[pageSize - 1] : null,
      hasMore,
    };
  }

  async getOrderById(id: string): Promise<OrderDoc | null> {
    const q = query(this.col, where('order_id', '==', id));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return this.mapOrderDoc(snap.docs[0].id, snap.docs[0].data());
    }

    const docSnap = await getDoc(doc(firebaseDb, COLLECTIONS.orders, id));
    if (!docSnap.exists()) return null;
    return this.mapOrderDoc(docSnap.id, docSnap.data());
  }

  async refundOrder(id: string, reason: string): Promise<void> {
    const order = await this.getOrderById(id);
    if (!order) throw new Error('Order not found');

    const orderRef = doc(firebaseDb, COLLECTIONS.orders, id);
    await updateDoc(orderRef, {
      status: 'refunded',
      refundReason: reason,
      updatedAt: new Date(),
    });
  }

  private mapOrderDoc(id: string, data: DocumentData): OrderDoc {
    return {
      id: data['order_id'] || id,
      customerId: data['user_id'] || '',
      customerName: data['customerName'] || 'Customer',
      customerEmail: data['customerEmail'] || '',
      eventId: data['event_id'] || '',
      eventName: data['eventName'] || 'VibeTix Event',
      items: data['items'] || [],
      totalTickets: data['total_tickets'] || data['items']?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 1,
      amount: data['total_amount'] || 0,
      status: (data['status'] || 'pending').toLowerCase() as OrderStatus,
      createdAt: data['order_date'] || data['createdAt'] || new Date(),
    };
  }
}
