import { Injectable } from '@angular/core';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { firebaseDb } from '../firebase/firebase.client';
import { COLLECTIONS } from '../firebase/collections';
import { PaginatedResult } from './users.service';

export interface PaymentDoc {
  id: string;
  paymentId: string;
  invoiceId: string;
  method: string;
  transactionId: string;
  amount: number;
  paymentDate: any;
  status: 'success' | 'failed' | 'refunded';
  note?: string;
}

export interface PaymentQuery {
  status?: string;
  method?: string;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData>;
}

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private col = collection(firebaseDb, COLLECTIONS.payments);

  async getPayments(params: PaymentQuery): Promise<PaginatedResult<PaymentDoc>> {
    const pageSize = params.pageSize ?? 10;
    let q = query(this.col, orderBy('payment_date', 'desc'), limit(pageSize + 1));

    if (params.status) {
      q = query(q, where('status', '==', params.status.toLowerCase()));
    }
    if (params.method) {
      q = query(q, where('method', '==', params.method.toLowerCase()));
    }
    if (params.cursor) {
      q = query(q, startAfter(params.cursor));
    }

    const snap = await getDocs(q);
    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map((d) => this.mapPaymentDoc(d.id, d.data()));

    return {
      items,
      lastDoc: hasMore ? docs[pageSize - 1] : null,
      hasMore,
    };
  }

  private mapPaymentDoc(id: string, data: DocumentData): PaymentDoc {
    return {
      id: data['payment_id'] || id,
      paymentId: data['payment_id'] || id,
      invoiceId: data['invoice_id'] || '',
      method: data['method'] || '',
      transactionId: data['transaction_id'] || '',
      amount: data['amount'] || 0,
      paymentDate: data['payment_date'] || new Date(),
      status: (data['status'] || 'success').toLowerCase() as any,
      note: data['note'] || '',
    };
  }
}
