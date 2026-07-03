import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentsService, PaymentDoc } from '../../core/services/payments.service';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrapper">
      <div class="breadcrumb">
        <span>Dashboard</span>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">Payments</span>
      </div>

      <div class="page-header">
        <div>
          <h1 class="page-title">Payment History</h1>
          <p class="page-subtitle">Track payment gateways and transaction history.</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <div class="form-control-icon" style="flex:1;max-width:300px;position:relative;">
          <span class="icon-left" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);display:flex;color:var(--color-text-muted);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input type="search" class="form-control input-search" style="padding-left:34px;height:36px;" placeholder="Search Payment ID, Invoice ID or TXN..." [(ngModel)]="searchTerm" (input)="applyFilters()" />
        </div>
        <select class="form-control" style="width:140px;height:36px;" [(ngModel)]="selectedMethod" (change)="applyFilters()">
          <option value="">All Gateways</option>
          <option value="momo">MoMo</option>
          <option value="zalopay">ZaloPay</option>
          <option value="vnpay">VNPay</option>
          <option value="visa">Visa</option>
          <option value="mastercard">Mastercard</option>
        </select>
        <select class="form-control" style="width:140px;height:36px;" [(ngModel)]="selectedStatus" (change)="applyFilters()">
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <div style="position:relative; display:flex; align-items:center; gap:8px;">
          <span style="font-size:12px; color:var(--color-text-secondary); font-weight:500;">Min Amount:</span>
          <input type="number" class="form-control" style="width:90px; height:36px; padding:6px 10px;" placeholder="0" [(ngModel)]="minAmount" (input)="applyFilters()" min="0" />
        </div>
        <button class="btn btn-ghost btn-sm" (click)="resetFilters()">Clear Filters</button>
      </div>

      <!-- Table Card -->
      <div class="card" style="padding:0;overflow:hidden;">
        @if (loading()) {
          <div style="padding:40px; text-align:center;" class="text-muted">Loading payments...</div>
        } @else {
          <div class="table-container" style="border:none; border-radius:0; margin:0; box-shadow:none;">
            <table class="table">
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Invoice ID</th>
                  <th>Gateway Method</th>
                  <th>Transaction ID</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment Date</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (payment of paginatedPayments; track payment.id) {
                  <tr>
                    <td><span class="order-id" style="font-family:monospace; font-size:13px;">{{ payment.paymentId }}</span></td>
                    <td><span class="text-muted" style="font-family:monospace; font-size:12px;">{{ payment.invoiceId || '—' }}</span></td>
                    <td>
                      <span class="badge badge-info" style="text-transform:uppercase;">
                        {{ payment.method || 'Unknown' }}
                      </span>
                    </td>
                    <td><span style="font-family:monospace; font-size:13px; color:var(--color-primary);">{{ payment.transactionId || '—' }}</span></td>
                    <td class="font-semibold">{{ formatCurrency(payment.amount) }}</td>
                    <td>
                      <span class="badge" [ngClass]="getStatusClass(payment.status)">
                        {{ payment.status | uppercase }}
                      </span>
                    </td>
                    <td class="text-sm text-muted">{{ formatDate(payment.paymentDate) }}</td>
                    <td style="text-align:right;">
                      <div class="action-row" style="justify-content:flex-end;">
                        <button class="btn btn-sm btn-ghost" (click)="viewDetails(payment)">Details</button>
                      </div>
                    </td>
                  </tr>
                }
                @if (filteredPayments().length === 0) {
                  <tr>
                    <td colspan="8" style="text-align:center; padding:48px; color:var(--color-text-muted);">
                      No payments found matching filters.
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

    <!-- Detail Modal -->
    @if (detailModalOpen()) {
      <div class="modal-backdrop">
        <div class="modal-card" style="max-width:540px;">
          <div class="modal-header">
            <h3>Payment Details</h3>
            <button class="btn-icon" (click)="detailModalOpen.set(false)">×</button>
          </div>
          <div class="modal-body">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
              <div>
                <span class="text-xs text-muted">PAYMENT ID</span>
                <p class="font-semibold" style="font-family:monospace;">{{ selectedPayment()?.paymentId }}</p>
              </div>
              <div>
                <span class="text-xs text-muted">STATUS</span>
                <div>
                  <span class="badge" [ngClass]="getStatusClass(selectedPayment()?.status || 'success')">
                    {{ selectedPayment()?.status | uppercase }}
                  </span>
                </div>
              </div>
              <div>
                <span class="text-xs text-muted">INVOICE ID</span>
                <p style="font-family:monospace; font-size:12px;">{{ selectedPayment()?.invoiceId || '—' }}</p>
              </div>
              <div>
                <span class="text-xs text-muted">TRANSACTION ID</span>
                <p style="font-family:monospace; font-size:12px; color:var(--color-primary);">{{ selectedPayment()?.transactionId || '—' }}</p>
              </div>
              <div>
                <span class="text-xs text-muted">AMOUNT</span>
                <p class="font-semibold">{{ formatCurrency(selectedPayment()?.amount || 0) }}</p>
              </div>
              <div>
                <span class="text-xs text-muted">DATE</span>
                <p>{{ formatDate(selectedPayment()?.paymentDate) }}</p>
              </div>
            </div>
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
export class Payments implements OnInit {
  private paymentsSvc = inject(PaymentsService);

  payments = signal<PaymentDoc[]>([]);
  filteredPayments = signal<PaymentDoc[]>([]);
  loading = signal(true);

  // Pagination
  currentPage = signal(1);
  pageSize = signal(20);

  // Filters
  searchTerm = '';
  selectedMethod = '';
  selectedStatus = '';
  minAmount: number | null = null;

  // Modals
  detailModalOpen = signal(false);
  selectedPayment = signal<PaymentDoc | null>(null);

  // Computed Pagination Properties
  get paginatedPayments(): PaymentDoc[] {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredPayments().slice(start, start + this.pageSize());
  }

  get totalPages(): number {
    return Math.ceil(this.filteredPayments().length / this.pageSize()) || 1;
  }

  getPageStart(): number {
    if (this.filteredPayments().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  }

  getPageEnd(): number {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredPayments().length);
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
    this.loadPayments();
  }

  async loadPayments(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.paymentsSvc.getPayments({
        pageSize: 1000,
      });

      this.payments.set(res.items);
      this.applyFilters();
    } catch (err) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  applyFilters(): void {
    let list = this.payments();

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      list = list.filter((p) => 
        (p.paymentId || '').toLowerCase().includes(term) || 
        (p.invoiceId || '').toLowerCase().includes(term) || 
        (p.transactionId || '').toLowerCase().includes(term)
      );
    }

    if (this.selectedMethod) {
      list = list.filter((p) => p.method === this.selectedMethod);
    }

    if (this.selectedStatus) {
      list = list.filter((p) => p.status === this.selectedStatus);
    }

    if (this.minAmount !== null && this.minAmount > 0) {
      list = list.filter((p) => (p.amount || 0) >= this.minAmount!);
    }

    // Sort newest first
    list.sort((a, b) => {
      const dateA = a.paymentDate instanceof Timestamp ? a.paymentDate.toDate().getTime() : (a.paymentDate ? new Date(a.paymentDate).getTime() : 0);
      const dateB = b.paymentDate instanceof Timestamp ? b.paymentDate.toDate().getTime() : (b.paymentDate ? new Date(b.paymentDate).getTime() : 0);
      return dateB - dateA;
    });

    this.filteredPayments.set(list);
    this.currentPage.set(1);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedMethod = '';
    this.selectedStatus = '';
    this.minAmount = null;
    this.applyFilters();
  }

  viewDetails(payment: PaymentDoc): void {
    this.selectedPayment.set(payment);
    this.detailModalOpen.set(true);
  }

  formatCurrency(val: number): string {
    return '$' + val.toLocaleString();
  }

  formatDate(ts: any): string {
    if (!ts) return '—';
    const d = ts instanceof Timestamp ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      success: 'badge-completed',
      failed: 'badge-refunded',
      refunded: 'badge-pending',
    };
    return map[status] ?? 'badge-gray';
  }
}
