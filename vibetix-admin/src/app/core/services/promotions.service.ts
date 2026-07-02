import { Injectable } from '@angular/core';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  startAfter,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { firebaseDb } from '../firebase/firebase.client';
import { COLLECTIONS } from '../firebase/collections';
import { PaginatedResult } from './users.service';

export interface PromotionDoc {
  id: string;
  code: string;
  title: string;
  description: string;
  type: 'percentage' | 'fixed';
  value: number;
  maxDiscount: number;
  minOrderValue: number;
  startDate: any;
  expiryDate: any;
  creatorType: 'admin' | 'organizer';
  scope: 'global' | 'event';
  eventId?: string;
  isActive: boolean;
  usageLimit: number;
  usedCount: number;
  createdBy: string;
}

export interface PromotionQuery {
  isActive?: boolean;
  scope?: string;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData>;
}

@Injectable({ providedIn: 'root' })
export class PromotionsService {
  private col = collection(firebaseDb, COLLECTIONS.discounts);

  async getPromotions(params: PromotionQuery): Promise<PaginatedResult<PromotionDoc>> {
    const pageSize = params.pageSize ?? 10;
    let q = query(this.col, orderBy('start_date', 'desc'), limit(pageSize + 1));

    if (params.isActive !== undefined) {
      q = query(q, where('is_active', '==', params.isActive));
    }
    if (params.scope) {
      q = query(q, where('scope', '==', params.scope));
    }
    if (params.cursor) {
      q = query(q, startAfter(params.cursor));
    }

    const snap = await getDocs(q);
    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const items = docs.slice(0, pageSize).map((d) => this.mapPromotionDoc(d.id, d.data()));

    return {
      items,
      lastDoc: hasMore ? docs[pageSize - 1] : null,
      hasMore,
    };
  }

  async createPromotion(promo: Omit<PromotionDoc, 'id'>): Promise<void> {
    const id = doc(this.col).id;
    await setDoc(doc(this.col, id), {
      discount_id: id,
      code: promo.code,
      title: promo.title,
      description: promo.description,
      type: promo.type,
      value: promo.value,
      max_discount: promo.maxDiscount,
      min_order_value: promo.minOrderValue,
      start_date: promo.startDate,
      expiry_date: promo.expiryDate,
      creator_type: 'admin',
      scope: promo.scope,
      event_id: promo.eventId || null,
      is_active: promo.isActive,
      usage_limit: promo.usageLimit,
      usage_per_user: 1,
      used_count: 0,
      created_by: promo.createdBy,
    });
  }

  async updatePromotion(id: string, updates: Partial<PromotionDoc>): Promise<void> {
    const ref = doc(this.col, id);
    const data: Record<string, any> = {};
    if (updates.code !== undefined) data['code'] = updates.code;
    if (updates.title !== undefined) data['title'] = updates.title;
    if (updates.description !== undefined) data['description'] = updates.description;
    if (updates.type !== undefined) data['type'] = updates.type;
    if (updates.value !== undefined) data['value'] = updates.value;
    if (updates.maxDiscount !== undefined) data['max_discount'] = updates.maxDiscount;
    if (updates.minOrderValue !== undefined) data['min_order_value'] = updates.minOrderValue;
    if (updates.startDate !== undefined) data['start_date'] = updates.startDate;
    if (updates.expiryDate !== undefined) data['expiry_date'] = updates.expiryDate;
    if (updates.scope !== undefined) data['scope'] = updates.scope;
    if (updates.eventId !== undefined) data['event_id'] = updates.eventId;
    if (updates.isActive !== undefined) data['is_active'] = updates.isActive;
    if (updates.usageLimit !== undefined) data['usage_limit'] = updates.usageLimit;

    await updateDoc(ref, data);
  }

  async deletePromotion(id: string): Promise<void> {
    await deleteDoc(doc(this.col, id));
  }

  private mapPromotionDoc(id: string, data: DocumentData): PromotionDoc {
    return {
      id: data['discount_id'] || id,
      code: data['code'] || '',
      title: data['title'] || '',
      description: data['description'] || '',
      type: data['type'] || 'percentage',
      value: data['value'] || 0,
      maxDiscount: data['max_discount'] || 0,
      minOrderValue: data['min_order_value'] || 0,
      startDate: data['start_date'],
      expiryDate: data['expiry_date'],
      creatorType: data['creator_type'] || 'admin',
      scope: data['scope'] || 'global',
      eventId: data['event_id'],
      isActive: data['is_active'] !== false,
      usageLimit: data['usage_limit'] || 0,
      usedCount: data['used_count'] || 0,
      createdBy: data['created_by'] || '',
    };
  }
}
