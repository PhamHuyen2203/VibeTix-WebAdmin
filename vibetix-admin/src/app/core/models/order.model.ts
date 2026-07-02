import { Timestamp } from 'firebase/firestore';

export type OrderStatus = 'pending' | 'completed' | 'refunded' | 'cancelled';

export interface OrderItem {
  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderDoc {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerAvatar?: string;
  eventId: string;
  eventName: string;
  eventDate?: Timestamp | Date;
  items: OrderItem[];
  totalTickets: number;
  amount: number;
  status: OrderStatus;
  paymentId?: string;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  refundReason?: string;
}
