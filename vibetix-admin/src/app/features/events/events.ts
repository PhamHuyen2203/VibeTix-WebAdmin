import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventsService } from '../../core/services/events.service';
import { OrganizersService } from '../../core/services/organizers.service';
import { AdminFunctions } from '../../core/services/admin-functions';
import { NotificationService } from '../../core/services/notification';
import { EventDoc, EventStatus } from '../../core/models/event.model';
import { OrganizerProfile } from '../../core/models/organizer.model';
import { Timestamp, collection, getDocs } from 'firebase/firestore';
import { firebaseDb } from '../../core/firebase/firebase.client';
import { COLLECTIONS } from '../../core/firebase/collections';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './events.html',
  styleUrl: './events.css',
})
export class Events implements OnInit {
  private eventSvc = inject(EventsService);
  private orgSvc = inject(OrganizersService);
  private adminFns = inject(AdminFunctions);
  private notif = inject(NotificationService);

  loading = signal(true);
  actionLoading = signal<string | null>(null);

  events = signal<EventDoc[]>([]);
  filteredEvents = signal<EventDoc[]>([]);
  paginatedEvents = signal<EventDoc[]>([]);

  // Stats
  totalCount = this.eventSvc.totalCount;
  pendingCount = this.eventSvc.pendingCount;
  approvedCount = this.eventSvc.approvedCount;
  cancelledCount = this.eventSvc.cancelledCount;

  // Selected Detail
  selectedEvent = signal<EventDoc | null>(null);

  // Filters & Sorting
  searchTerm = '';
  filterStatus: EventStatus | '' = '';
  filterCategory = '';
  filterStartDate = '';
  filterEndDate = '';
  minRevenue: number | null = null;
  sortBy = 'newest';

  Math = Math;

  // Dynamic filter choices loaded from dataset
  categoriesList = signal<{ id: string; name: string }[]>([]);
  organizersList = signal<OrganizerProfile[]>([]);

  // Pagination
  currentPage = signal(1);
  pageSize = signal(20);
  totalPages = signal(1);

  // Bulk Selection
  selectedEventIds = signal<Set<string>>(new Set());

  // Modals
  editModalOpen = signal(false);
  showRejectModal = signal(false);
  showCancelModal = signal(false);
  showDeleteConfirmModal = signal(false);
  eventToDelete = signal<EventDoc | null>(null);

  actionReason = signal('');

  // Form states

  editForm = {
    title: '',
    description: '',
    categoryId: '',
    venueName: '',
    venueAddress: '',
    startTime: '',
    endTime: '',
    totalTickets: 100,
  };

  async ngOnInit(): Promise<void> {
    await this.refreshAll();
  }

  async refreshAll(): Promise<void> {
    await Promise.all([
      this.eventSvc.loadCounts(),
      this.loadOrganizersList(),
      this.loadCategoriesList(),
      this.loadEvents(),
    ]);
  }

  async loadOrganizersList(): Promise<void> {
    try {
      const res = await this.orgSvc.getOrganizers({ pageSize: 1000 });
      this.organizersList.set(res.items);
    } catch (err) {
      console.error('Failed to load organizers list:', err);
    }
  }

  async loadCategoriesList(): Promise<void> {
    try {
      const categoriesCol = collection(firebaseDb, COLLECTIONS.categories);
      const snap = await getDocs(categoriesCol);
      const cats = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: data['category_id'] || doc.id,
          name: data['name'] || 'Other'
        };
      });
      if (cats.length === 0) {
        this.categoriesList.set([
          { id: 'Concerts', name: 'Concerts' },
          { id: 'Music Festivals', name: 'Music Festivals' },
          { id: 'Sports', name: 'Sports' },
          { id: 'Theatre', name: 'Theatre' },
          { id: 'Comedy', name: 'Comedy' }
        ]);
      } else {
        this.categoriesList.set(cats);
      }
    } catch (err) {
      console.error('Failed to load categories list:', err);
      this.categoriesList.set([
        { id: 'Concerts', name: 'Concerts' },
        { id: 'Music Festivals', name: 'Music Festivals' },
        { id: 'Sports', name: 'Sports' },
        { id: 'Theatre', name: 'Theatre' },
        { id: 'Comedy', name: 'Comedy' }
      ]);
    }
  }

  async loadEvents(): Promise<void> {
    this.loading.set(true);
    try {
      const [result, ordersSnap, orderItemsSnap] = await Promise.all([
        this.eventSvc.getEvents({ pageSize: 1000 }),
        getDocs(collection(firebaseDb, COLLECTIONS.orders)),
        getDocs(collection(firebaseDb, 'order_items'))
      ]);

      // Map order_id -> status to filter only completed orders
      const orderStatusMap: Record<string, string> = {};
      ordersSnap.docs.forEach(d => {
        const data = d.data();
        const id = data['order_id'] || d.id;
        orderStatusMap[id] = (data['status'] || '').toLowerCase();
      });

      const eventRevenueMap: Record<string, number> = {};
      const eventTicketsMap: Record<string, number> = {};

      orderItemsSnap.docs.forEach((d) => {
        const item = d.data();
        const orderId = item['order_id'] || '';
        const status = orderStatusMap[orderId];
        
        if (status !== 'completed' && status !== 'confirmed') return;

        const evId = item['event_id'] || '';
        if (!evId) return;

        const qty = Number(item['quantity'] || 1);
        const price = Number(item['price_per_ticket'] || 0);
        const itemTotal = qty * price;

        eventRevenueMap[evId] = (eventRevenueMap[evId] || 0) + itemTotal;
        eventTicketsMap[evId] = (eventTicketsMap[evId] || 0) + qty;
      });

      const updatedEvents = result.items.map((evt) => {
        const firestoreDocId = (evt as any)._firestoreDocId || '';
        const rev = (eventRevenueMap[evt.id] || 0) + (firestoreDocId && firestoreDocId !== evt.id ? (eventRevenueMap[firestoreDocId] || 0) : 0);
        const tkt = (eventTicketsMap[evt.id] || 0) + (firestoreDocId && firestoreDocId !== evt.id ? (eventTicketsMap[firestoreDocId] || 0) : 0);

        return {
          ...evt,
          revenue: rev,
          ticketSold: tkt > 0 ? tkt : evt.ticketSold,
        };
      });

      this.events.set(updatedEvents);
      this.applyFilters();
    } finally {
      this.loading.set(false);
    }
  }

  applyFilters(): void {
    const term = this.searchTerm.toLowerCase().trim();
    const status = this.filterStatus;
    const cat = this.filterCategory;
    const sort = this.sortBy;
    const start = this.filterStartDate ? new Date(this.filterStartDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    const end = this.filterEndDate ? new Date(this.filterEndDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    let list = this.events();

    // 1. Search
    if (term) {
      list = list.filter((e) =>
        (e.title || '').toLowerCase().includes(term) ||
        (e.venue || '').toLowerCase().includes(term) ||
        (e.organizerName || '').toLowerCase().includes(term)
      );
    }

    // 2. Status
    if (status) {
      list = list.filter((e) => e.status === status);
    }

    // 3. Category
    if (cat) {
      list = list.filter((e) => e.category === cat);
    }

    // 4. Time
    if (start || end) {
      list = list.filter((e) => {
        if (!e.date) return false;
        const eDate = e.date instanceof Timestamp ? e.date.toDate() : new Date(e.date);
        if (start && eDate < start) return false;
        if (end && eDate > end) return false;
        return true;
      });
    }

    // 5. Min Revenue
    if (this.minRevenue !== null && this.minRevenue !== undefined && this.minRevenue >= 0) {
      list = list.filter((e) => (e.revenue || 0) >= this.minRevenue!);
    }

    // 6. Sort
    list.sort((a, b) => {
      const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
      const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
      if (sort === 'newest') return dateB - dateA;
      if (sort === 'oldest') return dateA - dateB;
      if (sort === 'tickets') return b.totalTickets - a.totalTickets;
      if (sort === 'sales') return (b.ticketSold || 0) - (a.ticketSold || 0);
      return 0;
    });

    this.filteredEvents.set(list);
    this.currentPage.set(1);
    this.selectedEventIds.set(new Set()); // Reset selection when filters change
    this.updatePaginated();
  }

  updatePaginated(): void {
    const start = (this.currentPage() - 1) * this.pageSize();
    const end = start + this.pageSize();
    this.paginatedEvents.set(this.filteredEvents().slice(start, end));
    this.totalPages.set(Math.ceil(this.filteredEvents().length / this.pageSize()) || 1);
  }

  changePage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.currentPage.set(p);
    this.updatePaginated();
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.updatePaginated();
  }

  getPagesArray(): number[] {
    const arr = [];
    for (let i = 1; i <= this.totalPages(); i++) {
      arr.push(i);
    }
    return arr;
  }

  getPageStart(): number {
    if (this.filteredEvents().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  }

  getPageEnd(): number {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredEvents().length);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.filterStatus = '';
    this.filterCategory = '';
    this.filterStartDate = '';
    this.filterEndDate = '';
    this.minRevenue = null;
    this.sortBy = 'newest';
    this.applyFilters();
  }

  // Checkbox Selection Helpers
  isAllSelected(): boolean {
    const currentItems = this.paginatedEvents();
    if (currentItems.length === 0) return false;
    return currentItems.every((item) => this.selectedEventIds().has(item.id));
  }

  toggleSelectAll(): void {
    const currentItems = this.paginatedEvents();
    const currentSelection = new Set(this.selectedEventIds());

    if (this.isAllSelected()) {
      currentItems.forEach((item) => currentSelection.delete(item.id));
    } else {
      currentItems.forEach((item) => currentSelection.add(item.id));
    }
    this.selectedEventIds.set(currentSelection);
  }

  toggleSelectEvent(id: string): void {
    const currentSelection = new Set(this.selectedEventIds());
    if (currentSelection.has(id)) {
      currentSelection.delete(id);
    } else {
      currentSelection.add(id);
    }
    this.selectedEventIds.set(currentSelection);
  }

  selectEvent(event: EventDoc): void {
    this.selectedEvent.set(event);
  }

  closeDetail(): void {
    this.selectedEvent.set(null);
  }


  // Edit Event
  openEditModal(event: EventDoc): void {
    this.selectedEvent.set(event);
    this.editForm = {
      title: event.title,
      description: event.description || '',
      categoryId: event.category || 'Concerts',
      venueName: event.venue || '',
      venueAddress: event.location || '',
      startTime: event.date ? (event.date instanceof Timestamp ? event.date.toDate() : new Date(event.date)).toISOString().slice(0, 16) : '',
      endTime: event.endDate ? (event.endDate instanceof Timestamp ? event.endDate.toDate() : new Date(event.endDate)).toISOString().slice(0, 16) : '',
      totalTickets: event.totalTickets || 100,
    };
    this.editModalOpen.set(true);
  }

  async saveEditEvent(): Promise<void> {
    const event = this.selectedEvent();
    if (!event) return;

    if (!this.editForm.title) {
      this.notif.error('Event Title is required.');
      return;
    }

    this.loading.set(true);
    try {
      await this.adminFns.editEvent({
        eventId: event.id,
        title: this.editForm.title,
        description: this.editForm.description,
        categoryId: this.editForm.categoryId,
        venueName: this.editForm.venueName,
        venueAddress: this.editForm.venueAddress,
        startTime: this.editForm.startTime || undefined,
        endTime: this.editForm.endTime || undefined,
        totalTickets: Number(this.editForm.totalTickets),
      });
      this.editModalOpen.set(false);
      this.notif.success('Event updated successfully.');
      await this.refreshAll();
      this.selectedEvent.set(null);
    } catch (err: any) {
      this.notif.error('Failed to update event: ' + (err.message || err));
    } finally {
      this.loading.set(false);
    }
  }

  // Delete Event Modal
  deleteEvent(event: EventDoc): void {
    this.eventToDelete.set(event);
    this.showDeleteConfirmModal.set(true);
  }

  async confirmDeleteEvent(): Promise<void> {
    const event = this.eventToDelete();
    if (!event) return;
    this.showDeleteConfirmModal.set(false);
    this.actionLoading.set(event.id + '_delete');
    try {
      await this.adminFns.deleteEvent(event.id);
      this.notif.success('Event deleted successfully.');
      await this.refreshAll();
      this.selectedEvent.set(null);
      this.eventToDelete.set(null);
    } catch (err: any) {
      this.notif.error('Failed to delete event: ' + (err.message || err));
    } finally {
      this.actionLoading.set(null);
    }
  }

  async approve(): Promise<void> {
    const event = this.selectedEvent();
    if (!event) return;
    this.actionLoading.set('approve');
    try {
      await this.adminFns.approveEvent(event.id);
      this.updateEventStatus(event.id, 'approved');
      this.notif.success('Event approved!');
    } catch {
      this.notif.error('Failed to approve event.');
    } finally {
      this.actionLoading.set(null);
    }
  }

  async feature(): Promise<void> {
    const event = this.selectedEvent();
    if (!event) return;
    const newFeatured = !event.featured;
    this.actionLoading.set('feature');
    try {
      await this.adminFns.featureEvent(event.id, newFeatured);
      this.updateEventFeatured(event.id, newFeatured);
      this.notif.success(newFeatured ? 'Event featured!' : 'Event unfeatured.');
    } catch {
      this.notif.error('Failed to update event.');
    } finally {
      this.actionLoading.set(null);
    }
  }

  openRejectModal(): void { this.actionReason.set(''); this.showRejectModal.set(true); }
  openCancelModal(): void { this.actionReason.set(''); this.showCancelModal.set(true); }

  async confirmReject(): Promise<void> {
    const event = this.selectedEvent();
    if (!event || !this.actionReason()) return;
    this.actionLoading.set('reject');
    try {
      await this.adminFns.rejectEvent(event.id, this.actionReason());
      this.updateEventStatus(event.id, 'rejected');
      this.showRejectModal.set(false);
      this.notif.success('Event rejected.');
    } catch {
      this.notif.error('Failed to reject event.');
    } finally {
      this.actionLoading.set(null);
    }
  }

  async confirmCancel(): Promise<void> {
    const event = this.selectedEvent();
    if (!event || !this.actionReason()) return;
    this.actionLoading.set('cancel');
    try {
      await this.adminFns.cancelEvent(event.id, this.actionReason());
      this.updateEventStatus(event.id, 'cancelled');
      this.showCancelModal.set(false);
      this.notif.warning('Event cancelled.');
    } catch {
      this.notif.error('Failed to cancel event.');
    } finally {
      this.actionLoading.set(null);
    }
  }

  private updateEventStatus(id: string, status: EventStatus): void {
    this.events.update((list) => list.map((e) => (e.id === id ? { ...e, status } : e)));
    this.selectedEvent.update((e) => (e?.id === id ? { ...e!, status } : e));
    this.applyFilters();
  }

  private updateEventFeatured(id: string, featured: boolean): void {
    this.events.update((list) => list.map((e) => (e.id === id ? { ...e, featured } : e)));
    this.selectedEvent.update((e) => (e?.id === id ? { ...e!, featured } : e));
    this.applyFilters();
  }

  formatDate(ts: any): string {
    if (!ts) return '—';
    try {
      const d = ts instanceof Timestamp ? ts.toDate() : (typeof ts === 'string' || typeof ts === 'number' ? new Date(ts) : ts);
      if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  }

  getStatusClass(status: EventStatus): string {
    const map: Record<EventStatus, string> = {
      draft: 'badge-gray',
      pending_review: 'badge-pending-review',
      approved: 'badge-approved',
      rejected: 'badge-rejected',
      cancelled: 'badge-cancelled',
      featured: 'badge-featured',
    };
    return map[status] ?? 'badge-gray';
  }

  getStatusLabel(status: EventStatus): string {
    const map: Record<EventStatus, string> = {
      draft: 'Draft',
      pending_review: 'Pending Review',
      approved: 'Approved',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
      featured: 'Featured',
    };
    return map[status] ?? status;
  }

  ticketProgress(event: EventDoc): number {
    if (!event.totalTickets) return 0;
    return Math.round((event.ticketSold / event.totalTickets) * 100);
  }

  getCategoryName(categoryId: string): string {
    if (!categoryId) return '';
    const id = categoryId.toLowerCase();
    const cat = this.categoriesList().find(c => c.id.toLowerCase() === id || c.name.toLowerCase() === id);
    return cat ? cat.name : categoryId;
  }

  getCategoryClass(categoryNameOrId: string): string {
    const cat = (categoryNameOrId || '').toLowerCase().trim();
    if (cat.includes('concert')) return 'badge-concerts';
    if (cat.includes('music') || cat.includes('festival')) return 'badge-music';
    if (cat.includes('sport')) return 'badge-sports';
    if (cat.includes('theat') || cat.includes('play')) return 'badge-theater';
    if (cat.includes('comedy')) return 'badge-comedy';
    if (cat.includes('cultur') || cat.includes('art')) return 'badge-culture';
    return 'badge-primary';
  }
}
