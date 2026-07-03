import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrdersService, OrderQuery } from '../../core/services/orders.service';
import { OrderDoc, OrderStatus } from '../../core/models/order.model';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrapper">
      <div class="breadcrumb">
        <span>Dashboard</span>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">Orders</span>
      </div>

      <div class="page-header">
        <div>
          <h1 class="page-title">Order Management</h1>
          <p class="page-subtitle">View and manage all ticket orders across the platform.</p>
        </div>
      </div>

      <!-- Filters & Actions -->
      <div class="filter-bar">
        <div class="form-control-icon" style="flex:1;max-width:300px;position:relative;">
          <span class="icon-left" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);display:flex;color:var(--color-text-muted);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input type="search" class="form-control input-search" style="padding-left:34px;height:36px;" placeholder="Search Order ID or User ID..." [(ngModel)]="searchUserId" (input)="applyFilters()" />
        </div>
        <select class="form-control" style="width:150px;height:36px;" [(ngModel)]="selectedStatus" (change)="applyFilters()">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
        <div style="position:relative; display:flex; align-items:center; gap:8px;">
          <span style="font-size:12px; color:var(--color-text-secondary); font-weight:500;">Min Amount:</span>
          <input type="number" class="form-control" style="width:90px; height:36px; padding:6px 10px;" placeholder="0" [(ngModel)]="minAmount" (input)="applyFilters()" min="0" />
        </div>
        <select class="form-control" style="width:140px;height:36px;" [(ngModel)]="sortBy" (change)="applyFilters()">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="amount">Highest Amount</option>
        </select>
        <button class="btn btn-ghost btn-sm" (click)="resetFilters()">Clear Filters</button>
      </div>

      <!-- Table Card -->
      <div class="card" style="padding:0;overflow:hidden;">
        @if (loading()) {
          <div style="padding:40px; text-align:center;" class="text-muted">Loading orders...</div>
        } @else {
          <div class="table-container" style="border:none; border-radius:0; margin:0; box-shadow:none;">
            <table class="table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer UID</th>
                  <th>Event ID</th>
                  <th>Tickets</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Order Date</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (order of paginatedOrders; track order.id) {
                  <tr>
                    <td><span class="order-id" style="font-family:monospace; font-size:13px;">{{ order.id }}</span></td>
                    <td><span class="text-muted" style="font-family:monospace; font-size:12px;">{{ order.customerId }}</span></td>
                    <td><span class="text-muted" style="font-family:monospace; font-size:12px;">{{ order.eventId }}</span></td>
                    <td>{{ order.totalTickets }}</td>
                    <td class="font-semibold" style="color:var(--color-primary);">{{ formatCurrency(order.amount) }}</td>
                    <td>
                      <span class="badge" [ngClass]="getStatusClass(order.status)">
                        {{ getStatusLabel(order.status) }}
                      </span>
                    </td>
                    <td class="text-sm text-muted">{{ formatDate(order.createdAt) }}</td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex; gap:6px;">
                        <button class="btn btn-sm btn-outline" (click)="viewDetails(order)">Details</button>
                        @if (order.status === 'completed') {
                          <button class="btn btn-sm btn-danger" (click)="openRefundModal(order)">Refund</button>
                        }
                      </div>
                    </td>
                  </tr>
                }
                @if (filteredOrders().length === 0) {
                  <tr>
                    <td colspan="8" style="text-align:center; padding:48px; color:var(--color-text-muted);">
                      No orders found matching filters.
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

    <!-- Refund Modal -->
    @if (refundModalOpen()) {
      <div class="modal-backdrop">
        <div class="modal-card" style="max-width:480px;">
          <div class="modal-header">
            <h3>Confirm Refund</h3>
            <button class="btn-icon" (click)="closeRefundModal()">×</button>
          </div>
          <div class="modal-body">
            <p class="text-muted mb-3">Are you sure you want to refund Order #{{ selectedOrder()?.id }}? This action is irreversible.</p>
            <div class="form-group">
              <label>Reason for Refund</label>
              <textarea
                class="form-control"
                rows="3"
                placeholder="Enter customer refund reason..."
                [(ngModel)]="refundReason"
              ></textarea>
            </div>
          </div>
          <div class="modal-footer" style="display:flex; justify-content:end; gap:8px;">
            <button class="btn btn-outline" (click)="closeRefundModal()">Cancel</button>
            <button class="btn btn-danger" [disabled]="!refundReason" (click)="processRefund()">Process Refund</button>
          </div>
        </div>
      </div>
    }

    <!-- Detail Modal -->
    @if (detailModalOpen()) {
      <div class="modal-backdrop">
        <div class="modal-card" style="max-width:540px;">
          <div class="modal-header">
            <h3>Order Details</h3>
            <button class="btn-icon" (click)="detailModalOpen.set(false)">×</button>
          </div>
          <div class="modal-body">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
              <div>
                <span class="text-xs text-muted">ORDER ID</span>
                <p class="font-semibold" style="font-family:monospace;">{{ selectedOrder()?.id }}</p>
              </div>
              <div>
                <span class="text-xs text-muted">STATUS</span>
                <div>
                  <span class="badge" [ngClass]="getStatusClass(selectedOrder()?.status || 'pending')">
                    {{ getStatusLabel(selectedOrder()?.status || 'pending') }}
                  </span>
                </div>
              </div>
              <div>
                <span class="text-xs text-muted">CUSTOMER UID</span>
                <p style="font-family:monospace; font-size:12px;">{{ selectedOrder()?.customerId }}</p>
              </div>
              <div>
                <span class="text-xs text-muted">EVENT ID</span>
                <p style="font-family:monospace; font-size:12px;">{{ selectedOrder()?.eventId }}</p>
              </div>
              <div>
                <span class="text-xs text-muted">TOTAL AMOUNT</span>
                <p class="font-bold text-lg" style="color:var(--color-primary);">{{ formatCurrency(selectedOrder()?.amount || 0) }}</p>
              </div>
              <div>
                <span class="text-xs text-muted">ORDER DATE</span>
                <p>{{ formatDate(selectedOrder()?.createdAt) }}</p>
              </div>
            </div>
            
            @if (selectedOrder()?.items?.length) {
              <div style="border-top:1px solid var(--color-border); padding-top:12px;">
                <p class="font-semibold mb-2">Order Items</p>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  @for (item of selectedOrder()?.items; track item.ticketTypeId) {
                    <div style="display:flex; justify-content:space-between; font-size:13px; background:var(--color-background-sub); padding:8px; border-radius:6px;">
                      <div>
                        <span class="font-medium">{{ item.ticketTypeName || 'Ticket' }}</span>
                        <span class="text-muted"> x {{ item.quantity }}</span>
                      </div>
                      <span class="font-semibold">{{ formatCurrency(item.unitPrice * item.quantity) }}</span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" (click)="detailModalOpen.set(false)">Close</button>
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
      animation: modalFadeIn 0.2s ease-out;
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
      text-align: right;
    }
    @keyframes modalFadeIn {
      from { transform: translateY(12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class Orders implements OnInit {
  private ordersSvc = inject(OrdersService);

  orders = signal<OrderDoc[]>([]);
  filteredOrders = signal<OrderDoc[]>([]);
  loading = signal(true);

  // Pagination
  currentPage = signal(1);
  pageSize = signal(20);

  // Search & Filter
  searchUserId = '';
  selectedStatus: OrderStatus | '' = '';
  minAmount: number | null = null;
  sortBy = 'newest';

  // Computed Pagination Properties
  get paginatedOrders(): OrderDoc[] {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredOrders().slice(start, start + this.pageSize());
  }

  get totalPages(): number {
    return Math.ceil(this.filteredOrders().length / this.pageSize()) || 1;
  }

  getPageStart(): number {
    if (this.filteredOrders().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  }

  getPageEnd(): number {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredOrders().length);
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

  // Modals
  refundModalOpen = signal(false);
  detailModalOpen = signal(false);
  selectedOrder = signal<OrderDoc | null>(null);
  refundReason = '';

  ngOnInit(): void {
    this.loadOrders();
  }

  async loadOrders(): Promise<void> {
    this.loading.set(true);
    try {
      const query: OrderQuery = {
        pageSize: 1000,
      };

      const res = await this.ordersSvc.getOrders(query);
      this.orders.set(res.items);
      this.applyFilters();
    } catch (err) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  applyFilters(): void {
    let list = this.orders();

    if (this.searchUserId.trim()) {
      const term = this.searchUserId.toLowerCase().trim();
      list = list.filter((o) => o.id.toLowerCase().includes(term) || o.customerId.toLowerCase().includes(term));
    }

    if (this.selectedStatus) {
      list = list.filter((o) => o.status === this.selectedStatus);
    }

    if (this.minAmount !== null && this.minAmount !== undefined && this.minAmount >= 0) {
      list = list.filter((o) => (o.amount || 0) >= this.minAmount!);
    }

    // Sort
    list.sort((a, b) => {
      const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
      const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
      
      if (this.sortBy === 'newest') return dateB - dateA;
      if (this.sortBy === 'oldest') return dateA - dateB;
      if (this.sortBy === 'amount') return (b.amount || 0) - (a.amount || 0);
      return 0;
    });

    this.filteredOrders.set(list);
    this.currentPage.set(1);
  }

  resetFilters(): void {
    this.searchUserId = '';
    this.selectedStatus = '';
    this.minAmount = null;
    this.sortBy = 'newest';
    this.applyFilters();
  }

  viewDetails(order: OrderDoc): void {
    this.selectedOrder.set(order);
    this.detailModalOpen.set(true);
  }

  openRefundModal(order: OrderDoc): void {
    this.selectedOrder.set(order);
    this.refundReason = '';
    this.refundModalOpen.set(true);
  }

  closeRefundModal(): void {
    this.refundModalOpen.set(false);
  }

  async processRefund(): Promise<void> {
    const order = this.selectedOrder();
    if (!order) return;
    try {
      await this.ordersSvc.refundOrder(order.id, this.refundReason);
      
      // Update local state status
      this.orders.update((list) =>
        list.map((o) => (o.id === order.id ? { ...o, status: 'refunded' as const } : o))
      );
      this.applyFilters();
      this.closeRefundModal();
    } catch (err) {
      alert('Error processing refund: ' + err);
    }
  }

  formatCurrency(val: number): string {
    return '$' + val.toLocaleString();
  }

  formatDate(ts: Timestamp | Date | undefined): string {
    if (!ts) return '—';
    const d = ts instanceof Timestamp ? ts.toDate() : ts;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  getStatusClass(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      completed: 'badge-completed',
      pending: 'badge-pending',
      refunded: 'badge-refunded',
      cancelled: 'badge-cancelled',
    };
    return map[status] ?? 'badge-gray';
  }

  getStatusLabel(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      completed: 'Completed',
      pending: 'Pending',
      refunded: 'Refunded',
      cancelled: 'Cancelled',
    };
    return map[status] ?? status;
  }
}
