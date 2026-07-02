import { Timestamp } from 'firebase/firestore';

export type EventStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'featured';

export interface EventScheduleItem {
  time: string;
  activity: string;
}

export interface TicketTier {
  name: string;
  price: number;
  totalSeats: number;
  soldSeats: number;
}

export interface EventDocument {
  name: string;
  fileName: string;
  url?: string;
}

export interface EventDoc {
  id: string;
  title: string;
  description?: string;
  organizerId: string;
  organizerName: string;
  category: string;
  venue: string;
  location: string;
  date: Timestamp | Date;
  endDate?: Timestamp | Date;
  imageUrl?: string;
  ticketSold: number;
  totalTickets: number;
  revenue: number;
  status: EventStatus;
  schedule: EventScheduleItem[];
  pricing: TicketTier[];
  documents: EventDocument[];
  featured: boolean;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  rejectionReason?: string;
  cancellationReason?: string;
}
