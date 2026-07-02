import { Timestamp } from 'firebase/firestore';

export type TicketStatus = 'active' | 'used' | 'cancelled' | 'refunded';

export interface TicketDoc {
  id: string;
  orderId: string;
  userId: string;
  eventId: string;
  eventName?: string;
  ticketTypeId: string;
  ticketTypeName: string;
  seatNumber?: string;
  qrCode?: string;
  status: TicketStatus;
  checkedIn: boolean;
  checkedInAt?: Timestamp | Date;
  price: number;
  createdAt: Timestamp | Date;
}
