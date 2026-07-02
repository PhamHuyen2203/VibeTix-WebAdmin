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

export interface CategoryStat {
  category: string;
  ticketsSold: number;
  percentage: number;
}

export interface DashboardStats {
  totalUsers: number;
  activeOrganizers: number;
  pendingEvents: number;
  revenue30d: number;
  ticketsSold30d: number;
  refundRate30d: number;
  categoryStats: CategoryStat[];
  totalSalesAllTime: number;
  totalTicketsAllTime: number;
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
    const categoriesCol = collection(firebaseDb, COLLECTIONS.categories);
    const ticketsCol = collection(firebaseDb, COLLECTIONS.tickets);

    const [users, activeOrgs, pendingEvents, orders30d, categoriesSnap, eventsSnap, allCompletedOrders, ticketsCount] = await Promise.all([
      getCountFromServer(usersCol),
      getCountFromServer(query(organizersCol, where('is_verified', '==', true))),
      getCountFromServer(query(eventsCol, where('status_str', '==', 'pending'))),
      getDocs(
        query(ordersCol, where('status', '==', 'completed'), orderBy('order_date', 'desc'), limit(200))
      ),
      getDocs(categoriesCol),
      getDocs(eventsCol),
      getDocs(query(ordersCol, where('status', '==', 'completed'))),
      getCountFromServer(ticketsCol),
    ]);

    const revenue = orders30d.docs.reduce((sum, d) => {
      const data = d.data();
      return sum + (data['total_amount'] ?? 0);
    }, 0);

    const totalSalesAllTime = allCompletedOrders.docs.reduce((sum, d) => {
      const data = d.data();
      return sum + (data['total_amount'] ?? 0);
    }, 0);

    // Map category ID to category Name
    const categoryMap: Record<string, string> = {};
    categoriesSnap.docs.forEach((doc) => {
      const data = doc.data();
      categoryMap[doc.id] = data['name'] || 'Other';
      if (data['category_id']) {
        categoryMap[data['category_id']] = data['name'] || 'Other';
      }
    });

    // Sum tickets sold by category
    const ticketCounts: Record<string, number> = {};
    let totalTickets = 0;
    eventsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const catId = data['category_id'] || data['categoryId'] || 'others';
      const catName = categoryMap[catId] || catId;
      const sold = Number(data['tickets_sold'] || data['ticketsSold'] || 0);
      ticketCounts[catName] = (ticketCounts[catName] || 0) + sold;
      totalTickets += sold;
    });

    const categoryStats: CategoryStat[] = Object.entries(ticketCounts).map(([category, count]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      ticketsSold: count,
      percentage: totalTickets > 0 ? Math.round((count / totalTickets) * 100) : 0,
    })).sort((a, b) => b.ticketsSold - a.ticketsSold);

    if (categoryStats.length === 0) {
      categoryStats.push(
        { category: 'Concerts', ticketsSold: 0, percentage: 0 },
        { category: 'Music Festivals', ticketsSold: 0, percentage: 0 },
        { category: 'Sports', ticketsSold: 0, percentage: 0 },
        { category: 'Theatre', ticketsSold: 0, percentage: 0 },
        { category: 'Comedy', ticketsSold: 0, percentage: 0 }
      );
    }

    this.stats.set({
      totalUsers: users.data().count,
      activeOrganizers: activeOrgs.data().count,
      pendingEvents: pendingEvents.data().count,
      revenue30d: revenue,
      ticketsSold30d: totalTickets,
      refundRate30d: 0,
      categoryStats,
      totalSalesAllTime,
      totalTicketsAllTime: ticketsCount.data().count,
    });
  }

  private async loadRecentOrders(): Promise<void> {
    const q = query(
      collection(firebaseDb, COLLECTIONS.orders),
      orderBy('order_date', 'desc'),
      limit(5)
    );
    const snap = await getDocs(q);
    this.recentOrders.set(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: data['order_id'] || d.id,
          customerId: data['user_id'] || '',
          customerName: 'Customer', // Would require joining users collection
          eventId: '', 
          eventName: 'Event', 
          items: [],
          totalTickets: 0,
          amount: data['total_amount'] || 0,
          status: data['status'] || 'pending',
          createdAt: data['order_date'] || new Date(),
        } as unknown as OrderDoc;
      })
    );
  }

  private async loadPendingApprovals(): Promise<void> {
    const eventsQ = query(
      collection(firebaseDb, COLLECTIONS.events),
      where('status_str', '==', 'pending'),
      orderBy('created_at', 'desc'),
      limit(3)
    );
    const orgsQ = query(
      collection(firebaseDb, COLLECTIONS.organizers),
      where('is_verified', '==', false),
      orderBy('created_at', 'desc'),
      limit(2)
    );

    const [eventsSnap, orgsSnap] = await Promise.all([getDocs(eventsQ), getDocs(orgsQ)]);

    const approvals: PendingApproval[] = [
      ...eventsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: data['event_id'] || d.id,
          type: 'event' as const,
          name: data['title'] ?? 'Unnamed Event',
          subtitle: `${data['category_id'] ?? ''}`,
          submittedAgo: 'Recently',
          status: 'Event',
        };
      }),
      ...orgsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: data['organizer_id'] || d.id,
          type: 'organizer' as const,
          name: data['name'] ?? data['ownerName'] ?? 'Unknown',
          subtitle: 'Organizer Application',
          submittedAgo: 'Recently',
          status: 'Organizer',
        };
      }),
    ];

    this.pendingApprovals.set(approvals);
  }
}
