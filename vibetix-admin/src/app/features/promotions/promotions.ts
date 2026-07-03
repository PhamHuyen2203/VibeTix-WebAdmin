import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PromotionsService, PromotionDoc } from '../../core/services/promotions.service';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrapper">
      <div class="breadcrumb">
        <span>Dashboard</span>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">Promotions</span>
      </div>

      <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h1 class="page-title">Promotions</h1>
          <p class="page-subtitle">Create and manage coupon codes and event discounts.</p>
        </div>
        <button class="btn btn-primary" (click)="openCreateModal()">Create Coupon</button>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <div class="form-control-icon" style="flex:1;max-width:300px;position:relative;">
          <span class="icon-left" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);display:flex;color:var(--color-text-muted);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input type="search" class="form-control input-search" style="padding-left:34px;height:36px;" placeholder="Search by Code or Title..." [(ngModel)]="searchTerm" (input)="applyFilters()" />
        </div>
        <select class="form-control" style="width:140px;height:36px;" [(ngModel)]="selectedType" (change)="applyFilters()">
          <option value="">All Types</option>
          <option value="percentage">Percentage</option>
          <option value="fixed">Fixed Amount</option>
        </select>
        <select class="form-control" style="width:140px;height:36px;" [(ngModel)]="selectedScope" (change)="applyFilters()">
          <option value="">All Scopes</option>
          <option value="global">Global</option>
          <option value="event">Event-Specific</option>
        </select>
        <select class="form-control" style="width:140px;height:36px;" [(ngModel)]="selectedStatus" (change)="applyFilters()">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button class="btn btn-ghost btn-sm" (click)="resetFilters()">Clear Filters</button>
      </div>

      <!-- Table Card -->
      <div class="card" style="padding:0;overflow:hidden;">
        @if (loading()) {
          <div style="padding:40px; text-align:center;" class="text-muted">Loading promotions...</div>
        } @else {
          <div class="table-container" style="border:none; border-radius:0; margin:0; box-shadow:none;">
            <table class="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Min Order</th>
                  <th>Usage Limit</th>
                  <th>Used Count</th>
                  <th>Expiry Date</th>
                  <th>Active</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (promo of paginatedPromotions; track promo.id) {
                  <tr>
                    <td><span class="order-id" style="font-weight:700; color:var(--color-primary);">{{ promo.code }}</span></td>
                    <td>{{ promo.title }}</td>
                    <td>
                      <span class="badge" [ngClass]="promo.type === 'percentage' ? 'badge-info' : 'badge-completed'">
                        {{ promo.type | uppercase }}
                      </span>
                    </td>
                    <td>{{ promo.type === 'percentage' ? promo.value + '%' : formatCurrency(promo.value) }}</td>
                    <td>{{ formatCurrency(promo.minOrderValue) }}</td>
                    <td>{{ promo.usageLimit || 'Unlimited' }}</td>
                    <td>{{ promo.usedCount }}</td>
                    <td class="text-sm text-muted">{{ formatDate(promo.expiryDate) }}</td>
                    <td>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <span class="badge" [ngClass]="promo.isActive ? 'badge-completed' : 'badge-gray'">
                          {{ promo.isActive ? 'ACTIVE' : 'INACTIVE' }}
                        </span>
                        <label class="switch">
                          <input
                            type="checkbox"
                            [checked]="promo.isActive"
                            (change)="toggleActive(promo)"
                          />
                          <span class="slider round"></span>
                        </label>
                      </div>
                    </td>
                    <td style="text-align:right;">
                      <div class="action-row" style="justify-content:flex-end;">
                        <button class="btn btn-sm btn-ghost" (click)="openEditModal(promo)">Edit</button>
                        <button class="btn btn-sm btn-ghost text-error" (click)="confirmDelete(promo)">Delete</button>
                      </div>
                    </td>
                  </tr>
                }
                @if (filteredPromotions().length === 0) {
                  <tr>
                    <td colspan="10" style="text-align:center; padding:48px; color:var(--color-text-muted);">
                      No promotion codes found matching filters.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="table-footer">
            <div class="pagination">
              <button class="pagination-btn" [disabled]="currentPage() === 1" (click)="prevPage()">‹</button>
              @for (p of getPagesArray(); track p) {
                <button class="pagination-btn" [class.active]="currentPage() === p" (click)="currentPage.set(p)">{{ p }}</button>
              }
              <button class="pagination-btn" [disabled]="currentPage() >= totalPages" (click)="nextPage()">›</button>
            </div>
            <div class="rows-per-page">
              Rows per page
              <select class="form-control" style="width:70px;height:30px;font-size:12px;padding:2px 8px;" [(ngModel)]="pageSize" (change)="currentPage.set(1)">
                <option [ngValue]="10">10</option>
                <option [ngValue]="20">20</option>
                <option [ngValue]="50">50</option>
                <option [ngValue]="100">100</option>
              </select>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Create Promotion Modal -->
    @if (createModalOpen()) {
      <div class="modal-backdrop">
        <div class="modal-card" style="max-width:520px;">
          <div class="modal-header">
            <h3>{{ editingPromoId ? 'Edit Promotion Coupon' : 'Create Promotion Coupon' }}</h3>
            <button class="btn-icon" (click)="createModalOpen.set(false)">×</button>
          </div>
          <div class="modal-body" style="max-height: 80vh; overflow-y: auto;">
            <div class="form-group mb-3">
              <label>Coupon Code</label>
              <input type="text" class="form-control" placeholder="E.g. SUMMER50" [(ngModel)]="newCoupon.code" />
            </div>
            <div class="form-group mb-3">
              <label>Title</label>
              <input type="text" class="form-control" placeholder="Coupon name" [(ngModel)]="newCoupon.title" />
            </div>
            <div class="form-group mb-3">
              <label>Description</label>
              <input type="text" class="form-control" placeholder="Description" [(ngModel)]="newCoupon.description" />
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;" class="mb-3">
              <div class="form-group">
                <label>Discount Type</label>
                <select class="form-control" [(ngModel)]="newCoupon.type">
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount ($)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Value</label>
                <input type="number" class="form-control" [(ngModel)]="newCoupon.value" />
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;" class="mb-3">
              <div class="form-group">
                <label>Max Discount ($)</label>
                <input type="number" class="form-control" [(ngModel)]="newCoupon.maxDiscount" />
              </div>
              <div class="form-group">
                <label>Min Order Value ($)</label>
                <input type="number" class="form-control" [(ngModel)]="newCoupon.minOrderValue" />
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;" class="mb-3">
              <div class="form-group">
                <label>Start Date</label>
                <input type="date" class="form-control" [(ngModel)]="startDateStr" />
              </div>
              <div class="form-group">
                <label>Expiry Date</label>
                <input type="date" class="form-control" [(ngModel)]="expiryDateStr" />
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;" class="mb-3">
              <div class="form-group">
                <label>Scope</label>
                <select class="form-control" [(ngModel)]="newCoupon.scope">
                  <option value="global">Global</option>
                  <option value="event">Event-Specific</option>
                </select>
              </div>
              <div class="form-group">
                <label>Usage Limit</label>
                <input type="number" class="form-control" placeholder="E.g. 500" [(ngModel)]="newCoupon.usageLimit" />
              </div>
            </div>

            @if (newCoupon.scope === 'event') {
              <div class="form-group mb-3">
                <label>Event ID</label>
                <input type="text" class="form-control" placeholder="Event UID" [(ngModel)]="newCoupon.eventId" />
              </div>
            }
          </div>
          <div class="modal-footer" style="display:flex; justify-content:end; gap:8px;">
            <button class="btn btn-outline" (click)="createModalOpen.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="saveCoupon()">{{ editingPromoId ? 'Save Changes' : 'Create Coupon' }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Confirm Modal -->
    @if (confirmModalOpen()) {
      <div class="modal-backdrop" style="z-index: 1050;">
        <div class="modal-card" style="max-width:400px; text-align:center; padding: 24px;">
          <h3 style="margin-bottom:12px; color:var(--color-error);">Delete Promotion</h3>
          <p style="margin-bottom:24px; color:var(--color-text-muted);">
            Are you sure you want to delete coupon <strong style="color:var(--color-text);">{{ promoToDelete()?.code }}</strong>?<br/>
            This action cannot be undone.
          </p>
          <div style="display:flex; justify-content:center; gap:12px;">
            <button class="btn btn-outline" (click)="confirmModalOpen.set(false)">No, Cancel</button>
            <button class="btn btn-danger" (click)="executeDelete()">Yes, Delete</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-card {
      background: var(--color-white);
      border-radius: 12px;
      width: 90%;
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
      overflow: hidden;
    }
    .modal-header {
      padding: 16px;
      border-bottom: 1px solid var(--color-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-body {
      padding: 20px;
    }
    .modal-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--color-border);
      background: var(--color-background-sub);
    }
    
    /* Toggle switch CSS */
    .switch {
      position: relative;
      display: inline-block;
      width: 46px;
      height: 22px;
    }
    .switch input { 
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: #ccc;
      transition: .4s;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
    }
    input:checked + .slider {
      background-color: var(--color-primary);
    }
    input:checked + .slider:before {
      transform: translateX(24px);
    }
    .slider.round {
      border-radius: 34px;
    }
    .slider.round:before {
      border-radius: 50%;
    }
  `]
})
export class Promotions implements OnInit {
  private promotionsSvc = inject(PromotionsService);

  promotions = signal<PromotionDoc[]>([]);
  filteredPromotions = signal<PromotionDoc[]>([]);
  loading = signal(true);

  // Pagination
  currentPage = signal(1);
  pageSize = signal(20);

  // Filters
  searchTerm = '';
  selectedScope = '';
  selectedType = '';
  selectedStatus = '';

  // Modal create/edit
  createModalOpen = signal(false);
  editingPromoId: string | null = null;
  newCoupon: Omit<PromotionDoc, 'id'> = this.getEmptyCoupon();
  startDateStr = '';
  expiryDateStr = '';

  confirmModalOpen = signal(false);
  promoToDelete = signal<PromotionDoc | null>(null);

  // Computed Pagination Properties
  get paginatedPromotions(): PromotionDoc[] {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredPromotions().slice(start, start + this.pageSize());
  }

  get totalPages(): number {
    return Math.ceil(this.filteredPromotions().length / this.pageSize()) || 1;
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages) this.currentPage.update((p) => p + 1);
  }

  prevPage(): void {
    if (this.currentPage() > 1) this.currentPage.update((p) => p - 1);
  }

  getPagesArray(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  ngOnInit(): void {
    this.loadPromotions();
  }

  getEmptyCoupon(): Omit<PromotionDoc, 'id'> {
    return {
      code: '',
      title: '',
      description: '',
      type: 'percentage',
      value: 0,
      maxDiscount: 0,
      minOrderValue: 0,
      startDate: null,
      expiryDate: null,
      creatorType: 'admin',
      scope: 'global',
      eventId: '',
      isActive: true,
      usageLimit: 0,
      usedCount: 0,
      createdBy: 'Admin',
    };
  }

  async loadPromotions(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.promotionsSvc.getPromotions({
        pageSize: 1000,
      });

      this.promotions.set(res.items);
      this.applyFilters();
    } catch (err) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  applyFilters(): void {
    let list = this.promotions();

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      list = list.filter((p) => 
        (p.code || '').toLowerCase().includes(term) || 
        (p.title || '').toLowerCase().includes(term)
      );
    }

    if (this.selectedScope) {
      list = list.filter((p) => p.scope === this.selectedScope);
    }

    if (this.selectedType) {
      list = list.filter((p) => p.type === this.selectedType);
    }

    if (this.selectedStatus) {
      const isActiveFilter = this.selectedStatus === 'active';
      list = list.filter((p) => p.isActive === isActiveFilter);
    }

    // Sort newest first
    list.sort((a, b) => {
      const dateA = a.startDate instanceof Timestamp ? a.startDate.toDate().getTime() : (a.startDate ? new Date(a.startDate).getTime() : 0);
      const dateB = b.startDate instanceof Timestamp ? b.startDate.toDate().getTime() : (b.startDate ? new Date(b.startDate).getTime() : 0);
      return dateB - dateA;
    });

    this.filteredPromotions.set(list);
    this.currentPage.set(1);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedScope = '';
    this.selectedType = '';
    this.selectedStatus = '';
    this.applyFilters();
  }

  openCreateModal(): void {
    this.editingPromoId = null;
    this.newCoupon = this.getEmptyCoupon();
    this.startDateStr = '';
    this.expiryDateStr = '';
    this.createModalOpen.set(true);
  }

  openEditModal(promo: PromotionDoc): void {
    this.editingPromoId = promo.id;
    this.newCoupon = { ...promo };
    
    // Format dates for input type="date"
    const start = promo.startDate instanceof Timestamp ? promo.startDate.toDate() : (promo.startDate ? new Date(promo.startDate) : null);
    const end = promo.expiryDate instanceof Timestamp ? promo.expiryDate.toDate() : (promo.expiryDate ? new Date(promo.expiryDate) : null);
    
    this.startDateStr = start ? start.toISOString().split('T')[0] : '';
    this.expiryDateStr = end ? end.toISOString().split('T')[0] : '';
    
    this.createModalOpen.set(true);
  }

  async saveCoupon(): Promise<void> {
    if (!this.newCoupon.code || !this.newCoupon.title || this.newCoupon.value <= 0) {
      alert('Please fill out code, title and value.');
      return;
    }

    try {
      this.newCoupon.startDate = this.startDateStr ? Timestamp.fromDate(new Date(this.startDateStr)) : Timestamp.now();
      this.newCoupon.expiryDate = this.expiryDateStr ? Timestamp.fromDate(new Date(this.expiryDateStr)) : Timestamp.now();

      if (this.editingPromoId) {
        await this.promotionsSvc.updatePromotion(this.editingPromoId, this.newCoupon);
      } else {
        await this.promotionsSvc.createPromotion(this.newCoupon);
      }
      this.createModalOpen.set(false);
      this.loadPromotions();
    } catch (err) {
      alert('Error saving coupon: ' + err);
    }
  }

  async toggleActive(promo: PromotionDoc): Promise<void> {
    try {
      await this.promotionsSvc.updatePromotion(promo.id, { isActive: !promo.isActive });
      this.promotions.update((list) =>
        list.map((p) => (p.id === promo.id ? { ...p, isActive: !p.isActive } : p))
      );
      this.applyFilters();
    } catch (err) {
      alert('Error toggling state: ' + err);
    }
  }

  confirmDelete(promo: PromotionDoc): void {
    this.promoToDelete.set(promo);
    this.confirmModalOpen.set(true);
  }

  async executeDelete(): Promise<void> {
    const promo = this.promoToDelete();
    if (!promo) return;
    
    try {
      await this.promotionsSvc.deletePromotion(promo.id);
      this.promotions.update((list) => list.filter((p) => p.id !== promo.id));
      this.applyFilters();
    } catch (err) {
      alert('Error deleting coupon: ' + err);
    } finally {
      this.confirmModalOpen.set(false);
      this.promoToDelete.set(null);
    }
  }

  formatCurrency(val: number): string {
    return '$' + val.toLocaleString();
  }

  formatDate(ts: any): string {
    if (!ts) return '—';
    const d = ts instanceof Timestamp ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
