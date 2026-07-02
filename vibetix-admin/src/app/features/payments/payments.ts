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
      <div class="card mb-4" style="padding: 16px;">
        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <select
            class="form-control"
            [(ngModel)]="selectedMethod"
            style="width:160px; height:38px;"
          >
            <option value="">All Gateways</option>
            <option value="momo">MoMo</option>
            <option value="zalopay">ZaloPay</option>
            <option value="vnpay">VNPay</option>
            <option value="visa">Visa</option>
            <option value="mastercard">Mastercard</option>
          </select>
          <select
            class="form-control"
            [(ngModel)]="selectedStatus"
            style="width:160px; height:38px;"
          >
            <option value="">All Statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <button class="btn btn-primary" (click)="loadPayments()">Filter</button>
        </div>
      </div>

      <!-- Table Card -->
      <div class="card">
        @if (loading()) {
          <div style="padding:40px; text-align:center;" class="text-muted">Loading payments...</div>
        } @else {
          <div class="table-container" style="border:none; border-radius:0; margin:0;">
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
                </tr>
              </thead>
              <tbody>
                @for (payment of payments(); track payment.id) {
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
                  </tr>
                }
                @if (payments().length === 0) {
                  <tr>
                    <td colspan="7" style="text-align:center; padding:48px; color:var(--color-text-muted);">
                      No payments found.
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
  `
})
export class Payments implements OnInit {
  private paymentsSvc = inject(PaymentsService);

  payments = signal<PaymentDoc[]>([]);
  loading = signal(true);
  hasMore = signal(false);
  lastDoc: any = null;

  // Filters
  selectedMethod = '';
  selectedStatus = '';

  ngOnInit(): void {
    this.loadPayments();
  }

  async loadPayments(append = false): Promise<void> {
    this.loading.set(!append);
    try {
      const res = await this.paymentsSvc.getPayments({
        pageSize: 20,
        status: this.selectedStatus || undefined,
        method: this.selectedMethod || undefined,
        cursor: append ? this.lastDoc : undefined,
      });

      if (append) {
        this.payments.update((prev) => [...prev, ...res.items]);
      } else {
        this.payments.set(res.items);
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
      this.loadPayments(true);
    }
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
