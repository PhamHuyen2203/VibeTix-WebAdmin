import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EventsService } from '../../core/services/events.service';
import { AdminFunctions } from '../../core/services/admin-functions';
import { NotificationService } from '../../core/services/notification';
import { EventDoc, EventStatus } from '../../core/models/event.model';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-events',
  imports: [FormsModule],
  templateUrl: './events.html',
  styleUrl: './events.css',
})
export class Events implements OnInit {
  private eventSvc = inject(EventsService);
  private adminFns = inject(AdminFunctions);
  private notif = inject(NotificationService);

  loading = signal(true);
  actionLoading = signal<string | null>(null);

  events = signal<EventDoc[]>([]);
  totalCount = this.eventSvc.totalCount;
  pendingCount = this.eventSvc.pendingCount;
  approvedCount = this.eventSvc.approvedCount;
  cancelledCount = this.eventSvc.cancelledCount;

  selectedEvent = signal<EventDoc | null>(null);
  showRejectModal = signal(false);
  showCancelModal = signal(false);
  actionReason = signal('');

  filterStatus: EventStatus | '' = '';
  filterCategory = '';
  filterOrganizer = '';

  async ngOnInit(): Promise<void> {
    await Promise.all([this.eventSvc.loadCounts(), this.loadEvents()]);
  }

  async loadEvents(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.eventSvc.getEvents({
        status: this.filterStatus,
        category: this.filterCategory,
        pageSize: 10,
      });
      this.events.set(result.items);
    } finally {
      this.loading.set(false);
    }
  }

  selectEvent(event: EventDoc): void {
    this.selectedEvent.set(event);
  }

  closeDetail(): void {
    this.selectedEvent.set(null);
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
  }

  private updateEventFeatured(id: string, featured: boolean): void {
    this.events.update((list) => list.map((e) => (e.id === id ? { ...e, featured } : e)));
    this.selectedEvent.update((e) => (e?.id === id ? { ...e!, featured } : e));
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
