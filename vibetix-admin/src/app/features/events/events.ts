import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventsService } from '../../core/services/events.service';
import { OrganizersService } from '../../core/services/organizers.service';
import { AdminFunctions } from '../../core/services/admin-functions';
import { NotificationService } from '../../core/services/notification';
import { EventDoc, EventStatus } from '../../core/models/event.model';
import { OrganizerProfile } from '../../core/models/organizer.model';
import { Timestamp } from 'firebase/firestore';

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
  filterOrganizer = '';
  sortBy = 'newest';

  // Dynamic filter choices loaded from dataset
  uniqueCategories = signal<string[]>([]);
  organizersList = signal<OrganizerProfile[]>([]);

  // Pagination
  currentPage = signal(1);
  pageSize = signal(20);
  totalPages = signal(1);

  // Bulk Selection
  selectedEventIds = signal<Set<string>>(new Set());

  // Modals
  addModalOpen = signal(false);
  editModalOpen = signal(false);
  showRejectModal = signal(false);
  showCancelModal = signal(false);
  showDeleteConfirmModal = signal(false);
  eventToDelete = signal<EventDoc | null>(null);

  actionReason = signal('');

  // Form states
  newEvent = {
    title: '',
    description: '',
    organizerId: '',
    categoryId: 'Concerts',
    venueName: '',
    venueAddress: '',
    startTime: '',
    endTime: '',
    totalTickets: 100,
  };

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

  async loadEvents(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.eventSvc.getEvents({
        pageSize: 1000, // load all for client paging & indexing prevention
      });
      this.events.set(result.items);

      // Extract unique categories
      const cats = Array.from(new Set(result.items.map((e) => e.category).filter(Boolean)));
      this.uniqueCategories.set(cats);

      this.applyFilters();
    } finally {
      this.loading.set(false);
    }
  }

  applyFilters(): void {
    const term = this.searchTerm.toLowerCase().trim();
    const status = this.filterStatus;
    const cat = this.filterCategory;
    const org = this.filterOrganizer;
    const sort = this.sortBy;

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

    // 4. Organizer
    if (org) {
      list = list.filter((e) => e.organizerId === org);
    }

    // 5. Sort
    list.sort((a, b) => {
      const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
      const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
      if (sort === 'newest') return dateB - dateA;
      if (sort === 'oldest') return dateA - dateB;
      if (sort === 'tickets') return b.totalTickets - a.totalTickets;
      if (sort === 'sales') return b.ticketSold - a.ticketSold;
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
    this.filterOrganizer = '';
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

  // Create Event
  openAddModal(): void {
    const defaultOrg = this.organizersList()[0]?.id || '';
    this.newEvent = {
      title: '',
      description: '',
      organizerId: defaultOrg,
      categoryId: 'Concerts',
      venueName: '',
      venueAddress: '',
      startTime: '',
      endTime: '',
      totalTickets: 100,
    };
    this.addModalOpen.set(true);
  }

  async saveNewEvent(): Promise<void> {
    if (!this.newEvent.title || !this.newEvent.organizerId) {
      this.notif.error('Event Title and Organizer are required.');
      return;
    }

    const org = this.organizersList().find((o) => o.id === this.newEvent.organizerId);
    const organizerName = org ? org.businessName : 'Organizer';

    this.loading.set(true);
    try {
      await this.adminFns.createEvent({
        title: this.newEvent.title,
        description: this.newEvent.description,
        organizerId: this.newEvent.organizerId,
        organizerName,
        categoryId: this.newEvent.categoryId,
        venueName: this.newEvent.venueName || undefined,
        venueAddress: this.newEvent.venueAddress || undefined,
        startTime: this.newEvent.startTime || undefined,
        endTime: this.newEvent.endTime || undefined,
        totalTickets: Number(this.newEvent.totalTickets || 100),
      });
      this.addModalOpen.set(false);
      this.notif.success('Event created successfully.');
      await this.refreshAll();
    } catch (err: any) {
      this.notif.error('Failed to create event: ' + (err.message || err));
    } finally {
      this.loading.set(false);
    }
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

  formatDate(ts: Timestamp | Date | undefined): string {
    if (!ts) return '—';
    const d = ts instanceof Timestamp ? ts.toDate() : ts;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
}
