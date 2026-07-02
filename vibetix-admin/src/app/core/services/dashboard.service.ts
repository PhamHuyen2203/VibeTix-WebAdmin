import { Injectable, signal } from '@angular/core';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
} from 'firebase/firestore';
import { firebaseDb } from '../firebase/firebase.client';
import { COLLECTIONS } from '../firebase/collections';
import { OrderDoc } from '../models/order.model';

export interface DashboardStats {
  totalUsers: number;
  activeOrganizers: number;
  pendingEvents: number;
  revenue30d: number;
  ticketsSold30d: number;
  refundRate30d: number;
}

export interface PendingApproval {
  id: string;
  type: 'event' | 'organizer';
  name: string;
  subtitle: string;
  submittedAgo: string;
  status: string;
}

export interface ActivityItem {
  id: string;
  type: 'user_registered' | 'order_completed' | 'event_published' | 'payment_received' | 'refund_issued';
  message: string;
  sub?: string;
  timeAgo: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  stats = signal<DashboardStats | null>(null);
  recentOrders = signal<OrderDoc[]>([]);
  pendingApprovals = signal<PendingApproval[]>([]);
  recentActivity = signal<ActivityItem[]>([]);

  async loadDashboard(): Promise<void> {
    await Promise.all([
      this.loadStats(),
      this.loadRecentOrders(),
      this.loadPendingApprovals(),
    ]);
  }

  private async loadStats(): Promise<void> {
    const usersCol = collection(firebaseDb, COLLECTIONS.users);
    const organizersCol = collection(firebaseDb, COLLECTIONS.organizers);
    const eventsCol = collection(firebaseDb, COLLECTIONS.events);
    const ordersCol = collection(firebaseDb, COLLECTIONS.orders);

    const [users, activeOrgs, pendingEvents, orders30d] = await Promise.all([
      getCountFromServer(usersCol),
      getCountFromServer(query(organizersCol, where('status', '==', 'verified'))),
      getCountFromServer(query(eventsCol, where('status', '==', 'pending_review'))),
      getDocs(
        query(ordersCol, where('status', '==', 'completed'), orderBy('createdAt', 'desc'), limit(200))
      ),
    ]);

    const revenue = orders30d.docs.reduce((sum, d) => {
      const data = d.data() as OrderDoc;
      return sum + (data.amount ?? 0);
    }, 0);

    const tickets = orders30d.docs.reduce((sum, d) => {
      const data = d.data() as OrderDoc;
      return sum + (data.totalTickets ?? 0);
    }, 0);

    this.stats.set({
      totalUsers: users.data().count,
      activeOrganizers: activeOrgs.data().count,
      pendingEvents: pendingEvents.data().count,
      revenue30d: revenue,
      ticketsSold30d: tickets,
      refundRate30d: 1.32,
    });
  }

  private async loadRecentOrders(): Promise<void> {
    const q = query(
      collection(firebaseDb, COLLECTIONS.orders),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const snap = await getDocs(q);
    this.recentOrders.set(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrderDoc, 'id'>) }))
    );
  }

  private async loadPendingApprovals(): Promise<void> {
    const eventsQ = query(
      collection(firebaseDb, COLLECTIONS.events),
      where('status', '==', 'pending_review'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const orgsQ = query(
      collection(firebaseDb, COLLECTIONS.organizers),
      where('status', '==', 'pending'),
      orderBy('submittedAt', 'desc'),
      limit(2)
    );

    const [eventsSnap, orgsSnap] = await Promise.all([getDocs(eventsQ), getDocs(orgsQ)]);

    const approvals: PendingApproval[] = [
      ...eventsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: 'event' as const,
          name: data['title'] ?? 'Unnamed Event',
          subtitle: `${data['category'] ?? ''} • by ${data['organizerName'] ?? ''}`,
          submittedAgo: '2h ago',
          status: 'Event',
        };
      }),
      ...orgsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: 'organizer' as const,
          name: data['ownerName'] ?? 'Unknown',
          subtitle: 'Organizer Application',
          submittedAgo: '1d ago',
          status: 'Organizer',
        };
      }),
    ];

    this.pendingApprovals.set(approvals);
  }
}
