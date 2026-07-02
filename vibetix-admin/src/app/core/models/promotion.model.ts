import { Timestamp } from 'firebase/firestore';

export type DiscountType = 'percentage' | 'fixed';
export type DiscountStatus = 'active' | 'inactive' | 'expired';

export interface DiscountDoc {
  id: string;
  code: string;
  type: DiscountType;
  value: number;          // percent (0-100) or fixed amount
  eventId?: string;       // null = applies to all events
  eventName?: string;
  minOrderAmount?: number;
  maxUses: number;
  usedCount: number;
  expiresAt: Timestamp | Date;
  status: DiscountStatus;
  createdBy: string;      // admin uid
  createdAt: Timestamp | Date;
}
