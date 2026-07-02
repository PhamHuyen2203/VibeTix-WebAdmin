import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrganizersService } from '../../core/services/organizers.service';
import { AdminFunctions } from '../../core/services/admin-functions';
import { NotificationService } from '../../core/services/notification';
import { OrganizerProfile, OrganizerStatus } from '../../core/models/organizer.model';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-organizers',
  standalone: true,
  imports: [CommonModule, FormsModule, TitleCasePipe],
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
  filteredOrganizers = signal<OrganizerProfile[]>([]);
  paginatedOrganizers = signal<OrganizerProfile[]>([]);

  pendingCount = this.orgSvc.pendingCount;
  verifiedCount = this.orgSvc.verifiedCount;
  suspendedCount = this.orgSvc.suspendedCount;

  selectedOrganizer = signal<OrganizerProfile | null>(null);
  rejectReason = signal('');
  showRejectModal = signal(false);

  // Filters & Sorting
  searchTerm = '';
  filterStatus: OrganizerStatus | '' = '';
  filterCategory = '';
  sortBy = 'newest'; // newest, oldest, revenue

  uniqueCategories = signal<string[]>([]);
  showDeleteConfirmModal = signal(false);
  orgToDelete = signal<OrganizerProfile | null>(null);

  // Pagination
  currentPage = signal(1);
  pageSize = signal(20);
  totalPages = signal(1);

  // Add Modal
  addModalOpen = signal(false);
  newOrg = {
    brandName: '',
    contactEmail: '',
    contactPhone: '',
    description: '',
    websiteUrl: '',
    logoUrl: '',
    category: 'Entertainment',
  };

  // Edit Modal
  editModalOpen = signal(false);
  editForm = {
    brandName: '',
    description: '',
    websiteUrl: '',
    contactEmail: '',
    contactPhone: '',
    logoUrl: '',
  };

  async ngOnInit(): Promise<void> {
    await this.refreshAll();
  }

  async refreshAll(): Promise<void> {
    await Promise.all([this.orgSvc.loadCounts(), this.loadOrganizers()]);
  }

  async loadOrganizers(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.orgSvc.getOrganizers({
        pageSize: 1000, // fetch all to support perfect client filtering
      });
      this.organizers.set(result.items);
      const cats = Array.from(new Set(result.items.map((o) => o.category).filter(Boolean)));
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
    const sort = this.sortBy;

    let list = this.organizers();

    // 1. Search
    if (term) {
      list = list.filter((o) =>
        (o.businessName || '').toLowerCase().includes(term) ||
        (o.ownerName || '').toLowerCase().includes(term) ||
        (o.email || '').toLowerCase().includes(term) ||
        (o.phone || '').toLowerCase().includes(term)
      );
    }

    // 2. Status
    if (status) {
      list = list.filter((o) => o.status === status);
    }

    // 3. Category
    if (cat) {
      list = list.filter((o) => o.category === cat);
    }

    // 4. Sort
    list.sort((a, b) => {
      const timeA = a.submittedAt instanceof Timestamp ? a.submittedAt.toDate().getTime() : new Date(a.submittedAt).getTime();
      const timeB = b.submittedAt instanceof Timestamp ? b.submittedAt.toDate().getTime() : new Date(b.submittedAt).getTime();
      if (sort === 'newest') return timeB - timeA;
      if (sort === 'oldest') return timeA - timeB;
      if (sort === 'revenue') return (b.revenue30d ?? 0) - (a.revenue30d ?? 0);
      return 0;
    });

    this.filteredOrganizers.set(list);
    this.currentPage.set(1);
    this.updatePaginated();
  }

  updatePaginated(): void {
    const start = (this.currentPage() - 1) * this.pageSize();
    const end = start + this.pageSize();
    this.paginatedOrganizers.set(this.filteredOrganizers().slice(start, end));
    this.totalPages.set(Math.ceil(this.filteredOrganizers().length / this.pageSize()) || 1);
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
    if (this.filteredOrganizers().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  }

  getPageEnd(): number {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredOrganizers().length);
  }

  selectOrganizer(org: OrganizerProfile): void {
    this.selectedOrganizer.set(org);
  }

  closeDetail(): void {
    this.selectedOrganizer.set(null);
  }

  openEditModal(org: OrganizerProfile): void {
    this.selectedOrganizer.set(org);
    this.editForm = {
      brandName: org.businessName,
      description: org.description || '',
      websiteUrl: org.website || '',
      contactEmail: org.email,
      contactPhone: org.phone,
      logoUrl: org.logoUrl || '',
    };
    this.editModalOpen.set(true);
  }

  openAddModal(): void {
    this.newOrg = {
      brandName: '',
      contactEmail: '',
      contactPhone: '',
      description: '',
      websiteUrl: '',
      logoUrl: '',
      category: 'Entertainment',
    };
    this.addModalOpen.set(true);
  }

  async saveNewOrganizer(): Promise<void> {
    if (!this.newOrg.brandName || !this.newOrg.contactEmail) {
      this.notif.error('Brand Name and Contact Email are required.');
      return;
    }

    this.loading.set(true);
    try {
      await this.adminFns.createOrganizer(this.newOrg);
      this.addModalOpen.set(false);
      this.notif.success('Organizer created successfully.');
      await this.refreshAll();
    } catch (err: any) {
      this.notif.error('Failed to create organizer: ' + (err.message || err));
    } finally {
      this.loading.set(false);
    }
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.filterStatus = '';
    this.filterCategory = '';
    this.sortBy = 'newest';
    this.applyFilters();
  }

  async saveOrganizer(): Promise<void> {
    const org = this.selectedOrganizer();
    if (!org) return;

    if (!this.editForm.brandName || !this.editForm.contactEmail) {
      this.notif.error('Brand Name and Contact Email are required.');
      return;
    }

    this.loading.set(true);
    try {
      await this.adminFns.editOrganizer({
        organizerId: org.id,
        brandName: this.editForm.brandName,
        description: this.editForm.description || undefined,
        websiteUrl: this.editForm.websiteUrl || undefined,
        contactEmail: this.editForm.contactEmail,
        contactPhone: this.editForm.contactPhone || undefined,
        logoUrl: this.editForm.logoUrl || undefined,
      });
      this.editModalOpen.set(false);
      this.notif.success('Organizer details updated successfully.');
      await this.refreshAll();
      this.selectedOrganizer.set(null);
    } catch (err: any) {
      this.notif.error('Failed to edit organizer: ' + (err.message || err));
    } finally {
      this.loading.set(false);
    }
  }

  deleteOrganizer(org: OrganizerProfile): void {
    this.orgToDelete.set(org);
    this.showDeleteConfirmModal.set(true);
  }

  async confirmDeleteOrg(): Promise<void> {
    const org = this.orgToDelete();
    if (!org) return;
    this.showDeleteConfirmModal.set(false);
    this.actionLoading.set(org.id + '_delete');
    try {
      await this.adminFns.deleteOrganizer(org.id);
      this.notif.success('Organizer profile deleted successfully.');
      await this.refreshAll();
      this.selectedOrganizer.set(null);
      this.orgToDelete.set(null);
    } catch (err: any) {
      this.notif.error('Failed to delete organizer: ' + (err.message || err));
    } finally {
      this.actionLoading.set(null);
    }
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
      this.applyFilters();
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
      this.applyFilters();
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
      this.applyFilters();
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
