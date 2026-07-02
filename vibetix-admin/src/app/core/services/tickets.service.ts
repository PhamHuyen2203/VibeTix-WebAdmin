import { Injectable } from '@angular/core';
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
} from 'firebase/firestore';
import { firebaseDb } from '../firebase/firebase.client';
import { COLLECTIONS } from '../firebase/collections';
import { PaginatedResult } from './users.service';

export interface UserTicketDoc {
  id: string;
  userTicketId: string;
  orderItemId: string;
  eventId: string;
  userId: string;
  ticketCode: string;
  displayCode: string;
  status: 'valid' | 'used' | 'expired' | 'transferred' | 'cancelled';
  checkedInAt?: any;
  issuedAt?: any;
  createdAt: any;
}

export interface TicketQuery {
  status?: string;
  eventId?: string;
  ticketCode?: string;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData>;
}

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private col = collection(firebaseDb, COLLECTIONS.tickets);

  async getTickets(params: TicketQuery): Promise<PaginatedResult<UserTicketDoc>> {
    const pageSize = params.pageSize ?? 10;
    let q = query(this.col, orderBy('issued_at', 'desc'), limit(pageSize + 1));

    if (params.status) {
      q = query(q, where('status', '==', params.status.toLowerCase()));
    }
    if (params.eventId) {
      q = query(q, where('event_id', '==', params.eventId));
    }
    if (params.ticketCode) {
      q = query(q, where('ticket_code', '==', params.ticketCode));
    }
    if (params.cursor) {
      q = query(q, startAfter(params.cursor));
    }

    const snap = await getDocs(q);
    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map((d) => this.mapTicketDoc(d.id, d.data()));

    return {
      items,
      lastDoc: hasMore ? docs[pageSize - 1] : null,
      hasMore,
    };
  }

  async cancelTicket(id: string): Promise<void> {
    const ticketRef = doc(firebaseDb, COLLECTIONS.tickets, id);
    await updateDoc(ticketRef, {
      status: 'cancelled',
      updatedAt: new Date(),
    });
  }

  private mapTicketDoc(id: string, data: DocumentData): UserTicketDoc {
    return {
      id: data['user_ticket_id'] || id,
      userTicketId: data['user_ticket_id'] || id,
      orderItemId: data['order_item_id'] || '',
      eventId: data['event_id'] || '',
      userId: data['user_id'] || '',
      ticketCode: data['ticket_code'] || '',
      displayCode: data['display_code'] || '',
      status: (data['status'] || 'valid').toLowerCase() as any,
      checkedInAt: data['checked_in_at'],
      issuedAt: data['issued_at'],
      createdAt: data['created_at'] || new Date(),
    };
  }
}
