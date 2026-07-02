import { Timestamp } from 'firebase/firestore';

export type OrganizerStatus = 'pending' | 'verified' | 'suspended' | 'rejected';

export interface OrganizerDocument {
  name: string;
  fileName: string;
  url?: string;
  status: 'verified' | 'missing' | 'pending';
}

export interface OrganizerProfile {
  id: string;
  uid: string; // owner user uid
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  website?: string;
  category: string;
  location: string;
  description?: string;
  logoUrl?: string;
  status: OrganizerStatus;
  documents: OrganizerDocument[];
  eventsCount: number;
  revenue30d: number;
  submittedAt: Timestamp | Date;
  verifiedAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  rejectionReason?: string;
  suspensionReason?: string;
}
