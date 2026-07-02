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
      <div class="card mb-4" style="padding:16px;">
        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
          <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
            <input
              type="text"
              class="form-control"
              placeholder="Search by User ID..."
              [(ngModel)]="searchUserId"
              style="width:240px; height:38px;"
            />
            <select
              class="form-control"
              [(ngModel)]="selectedStatus"
              style="width:160px; height:38px;"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
            <button class="btn btn-primary" (click)="loadOrders()">Apply Filter</button>
          </div>
        </div>
      </div>

      <!-- Table Card -->
      <div class="card">
        @if (loading()) {
          <div style="padding:40px; text-align:center;" class="text-muted">Loading orders...</div>
        } @else {
          <div class="table-container" style="border:none; border-radius:0; margin:0;">
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
                @for (order of orders(); track order.id) {
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
                @if (orders().length === 0) {
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
          @if (hasMore()) {
            <div style="padding:16px; display:flex; justify-content:center; border-top:1px solid var(--color-border);">
              <button class="btn btn-outline" (click)="loadMore()">Load More</button>
            </div>
          }
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
  loading = signal(true);
  hasMore = signal(false);
  lastDoc: any = null;

  // Search & Filter
  searchUserId = '';
  selectedStatus: OrderStatus | '' = '';

  // Modals
  refundModalOpen = signal(false);
  detailModalOpen = signal(false);
  selectedOrder = signal<OrderDoc | null>(null);
  refundReason = '';

  ngOnInit(): void {
    this.loadOrders();
  }

  async loadOrders(append = false): Promise<void> {
    this.loading.set(!append);
    try {
      const query: OrderQuery = {
        pageSize: 20,
        status: this.selectedStatus || undefined,
        userId: this.searchUserId.trim() || undefined,
        cursor: append ? this.lastDoc : undefined,
      };

      const res = await this.ordersSvc.getOrders(query);
      if (append) {
        this.orders.update((prev) => [...prev, ...res.items]);
      } else {
        this.orders.set(res.items);
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
      this.loadOrders(true);
    }
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
