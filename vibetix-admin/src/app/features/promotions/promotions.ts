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
      <div class="card mb-4" style="padding: 16px;">
        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <select
            class="form-control"
            [(ngModel)]="selectedScope"
            style="width:160px; height:38px;"
          >
            <option value="">All Scopes</option>
            <option value="global">Global</option>
            <option value="event">Event-Specific</option>
          </select>
          <button class="btn btn-primary" (click)="loadPromotions()">Filter</button>
        </div>
      </div>

      <!-- Table Card -->
      <div class="card">
        @if (loading()) {
          <div style="padding:40px; text-align:center;" class="text-muted">Loading promotions...</div>
        } @else {
          <div class="table-container" style="border:none; border-radius:0; margin:0;">
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
                @for (promo of promotions(); track promo.id) {
                  <tr>
                    <td><span class="order-id" style="font-weight:700; color:var(--color-primary);">{{ promo.code }}</span></td>
                    <td>{{ promo.title }}</td>
                    <td style="text-transform:capitalize;">{{ promo.type }}</td>
                    <td>{{ promo.type === 'percentage' ? promo.value + '%' : formatCurrency(promo.value) }}</td>
                    <td>{{ formatCurrency(promo.minOrderValue) }}</td>
                    <td>{{ promo.usageLimit || 'Unlimited' }}</td>
                    <td>{{ promo.usedCount }}</td>
                    <td class="text-sm text-muted">{{ formatDate(promo.expiryDate) }}</td>
                    <td>
                      <!-- Toggle active switch -->
                      <label class="switch">
                        <input
                          type="checkbox"
                          [checked]="promo.isActive"
                          (change)="toggleActive(promo)"
                        />
                        <span class="slider round"></span>
                      </label>
                    </td>
                    <td style="text-align:right;">
                      <button class="btn btn-sm btn-danger" (click)="deleteCoupon(promo)">Delete</button>
                    </td>
                  </tr>
                }
                @if (promotions().length === 0) {
                  <tr>
                    <td colspan="10" style="text-align:center; padding:48px; color:var(--color-text-muted);">
                      No promotion codes found.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          @if (hasMore()) {
            <div style="padding:16px; display:flex; justify-content:center; border-top:1px solid var(--color-border);">
              <button class="btn btn-outline" (click)="loadMore()">Load More</button>
            </div>
          }
        }
      </div>
    </div>

    <!-- Create Promotion Modal -->
    @if (createModalOpen()) {
      <div class="modal-backdrop">
        <div class="modal-card" style="max-width:520px;">
          <div class="modal-header">
            <h3>Create Promotion Coupon</h3>
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
            <button class="btn btn-primary" (click)="saveCoupon()">Create Coupon</button>
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
  loading = signal(true);
  hasMore = signal(false);
  lastDoc: any = null;

  // Filters
  selectedScope = '';

  // Modal create
  createModalOpen = signal(false);
  newCoupon: Omit<PromotionDoc, 'id'> = this.getEmptyCoupon();
  startDateStr = '';
  expiryDateStr = '';

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

  async loadPromotions(append = false): Promise<void> {
    this.loading.set(!append);
    try {
      const res = await this.promotionsSvc.getPromotions({
        pageSize: 20,
        scope: this.selectedScope || undefined,
        cursor: append ? this.lastDoc : undefined,
      });

      if (append) {
        this.promotions.update((prev) => [...prev, ...res.items]);
      } else {
        this.promotions.set(res.items);
      }
      this.hasMore.set(res.hasMore);
      this.lastDoc = res.lastDoc;
    } catch (err) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  loadMore(): void {
    if (this.hasMore()) {
      this.loadPromotions(true);
    }
  }

  openCreateModal(): void {
    this.newCoupon = this.getEmptyCoupon();
    this.startDateStr = '';
    this.expiryDateStr = '';
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

      await this.promotionsSvc.createPromotion(this.newCoupon);
      this.createModalOpen.set(false);
      this.loadPromotions();
    } catch (err) {
      alert('Error creating coupon: ' + err);
    }
  }

  async toggleActive(promo: PromotionDoc): Promise<void> {
    try {
      await this.promotionsSvc.updatePromotion(promo.id, { isActive: !promo.isActive });
      this.promotions.update((list) =>
        list.map((p) => (p.id === promo.id ? { ...p, isActive: !p.isActive } : p))
      );
    } catch (err) {
      alert('Error toggling state: ' + err);
    }
  }

  async deleteCoupon(promo: PromotionDoc): Promise<void> {
    if (!confirm(`Are you sure you want to delete coupon ${promo.code}?`)) {
      return;
    }
    try {
      await this.promotionsSvc.deletePromotion(promo.id);
      this.promotions.update((list) => list.filter((p) => p.id !== promo.id));
    } catch (err) {
      alert('Error deleting coupon: ' + err);
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
