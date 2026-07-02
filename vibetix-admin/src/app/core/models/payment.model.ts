import { Timestamp } from 'firebase/firestore';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'card' | 'bank_transfer' | 'e_wallet' | 'vnpay' | 'momo' | 'zalopay';

export interface PaymentDoc {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  gatewayResponse?: string;
  refundedAt?: Timestamp | Date;
  refundAmount?: number;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}
