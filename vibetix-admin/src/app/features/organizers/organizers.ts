import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { OrganizersService } from '../../core/services/organizers.service';
import { AdminFunctions } from '../../core/services/admin-functions';
import { NotificationService } from '../../core/services/notification';
import { OrganizerProfile, OrganizerStatus } from '../../core/models/organizer.model';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-organizers',
  imports: [FormsModule, TitleCasePipe],
  templateUrl: './organizers.html',
  styleUrl: './organizers.css',
})
export class Organizers implements OnInit {
  private orgSvc = inject(OrganizersService);
  private adminFns = inject(AdminFunctions);
  private notif = inject(NotificationService);

  loading = signal(true);
  actionLoading = signal<string | null>(null);

  organizers = signal<OrganizerProfile[]>([]);
  pendingCount = this.orgSvc.pendingCount;
  verifiedCount = this.orgSvc.verifiedCount;
  suspendedCount = this.orgSvc.suspendedCount;

  selectedOrganizer = signal<OrganizerProfile | null>(null);
  rejectReason = signal('');
  showRejectModal = signal(false);

  filterStatus: OrganizerStatus | '' = '';
  filterCategory = '';
  searchTerm = '';

  async ngOnInit(): Promise<void> {
    await Promise.all([this.orgSvc.loadCounts(), this.loadOrganizers()]);
  }

  async loadOrganizers(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.orgSvc.getOrganizers({
        status: this.filterStatus,
        category: this.filterCategory,
        pageSize: 10,
      });
      this.organizers.set(result.items);
    } finally {
      this.loading.set(false);
    }
  }

  selectOrganizer(org: OrganizerProfile): void {
    this.selectedOrganizer.set(org);
  }

  closeDetail(): void {
    this.selectedOrganizer.set(null);
  }

  async approve(): Promise<void> {
    const org = this.selectedOrganizer();
    if (!org) return;
    this.actionLoading.set('approve');
    try {
      await this.adminFns.approveOrganizer(org.id);
      this.organizers.update((list) =>
        list.map((o) => (o.id === org.id ? { ...o, status: 'verified' as OrganizerStatus } : o))
      );
      this.selectedOrganizer.update((o) => o ? { ...o, status: 'verified' } : null);
      this.notif.success('Organizer approved successfully!');
    } catch {
      this.notif.error('Failed to approve organizer.');
    } finally {
      this.actionLoading.set(null);
    }
  }

  openRejectModal(): void {
    this.rejectReason.set('');
    this.showRejectModal.set(true);
  }

  async confirmReject(): Promise<void> {
    const org = this.selectedOrganizer();
    if (!org || !this.rejectReason()) return;
    this.actionLoading.set('reject');
    try {
      await this.adminFns.rejectOrganizer(org.id, this.rejectReason());
      this.organizers.update((list) =>
        list.map((o) => (o.id === org.id ? { ...o, status: 'rejected' as OrganizerStatus } : o))
      );
      this.selectedOrganizer.update((o) => o ? { ...o, status: 'rejected' } : null);
      this.showRejectModal.set(false);
      this.notif.success('Organizer rejected.');
    } catch {
      this.notif.error('Failed to reject organizer.');
    } finally {
      this.actionLoading.set(null);
    }
  }

  async suspend(): Promise<void> {
    const org = this.selectedOrganizer();
    if (!org) return;
    this.actionLoading.set('suspend');
    try {
      await this.adminFns.suspendOrganizer(org.id, 'Suspended by admin');
      this.organizers.update((list) =>
        list.map((o) => (o.id === org.id ? { ...o, status: 'suspended' as OrganizerStatus } : o))
      );
      this.selectedOrganizer.update((o) => o ? { ...o, status: 'suspended' } : null);
      this.notif.warning('Organizer suspended.');
    } catch {
      this.notif.error('Failed to suspend organizer.');
    } finally {
      this.actionLoading.set(null);
    }
  }

  formatDate(ts: Timestamp | Date | undefined): string {
    if (!ts) return '—';
    const d = ts instanceof Timestamp ? ts.toDate() : ts;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getStatusClass(status: OrganizerStatus): string {
    const map: Record<OrganizerStatus, string> = {
      pending: 'badge-pending',
      verified: 'badge-verified',
      suspended: 'badge-suspended',
      rejected: 'badge-rejected',
    };
    return map[status] ?? 'badge-gray';
  }

  getDocClass(status: string): string {
    const map: Record<string, string> = {
      verified: 'badge-success',
      missing: 'badge-error',
      pending: 'badge-warning',
    };
    return map[status] ?? 'badge-gray';
  }

  getInitials(name: string): string {
    return name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';
  }

  docsVerified(org: OrganizerProfile): number {
    return org.documents?.filter((d) => d.status === 'verified').length ?? 0;
  }
}
