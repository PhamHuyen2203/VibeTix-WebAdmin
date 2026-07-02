import { Timestamp } from 'firebase/firestore';

export type UserRole = 'customer' | 'user' | 'organizer' | 'admin';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'disabled';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  totalOrders?: number;
  totalSpent?: number;
  organizerId?: string; // set when role === 'organizer'
}
