import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TicketsService, UserTicketDoc } from '../../core/services/tickets.service';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrapper">
      <div class="breadcrumb">
        <span>Dashboard</span>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">Tickets</span>
      </div>

      <div class="page-header">
        <div>
          <h1 class="page-title">Ticket Management</h1>
          <p class="page-subtitle">View, verify, and invalidate tickets issued to customers.</p>
        </div>
      </div>

      <!-- Filters & Actions -->
      <div class="card mb-4" style="padding: 16px;">
        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <input
            type="text"
            class="form-control"
            placeholder="Search by Ticket Code..."
            [(ngModel)]="searchCode"
            style="width:240px; height:38px;"
          />
          <select
            class="form-control"
            [(ngModel)]="selectedStatus"
            style="width:160px; height:38px;"
          >
            <option value="">All Statuses</option>
            <option value="valid">Valid</option>
            <option value="used">Used</option>
            <option value="expired">Expired</option>
            <option value="transferred">Transferred</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button class="btn btn-primary" (click)="loadTickets()">Apply Filter</button>
        </div>
      </div>

      <!-- Table Card -->
      <div class="card">
        @if (loading()) {
          <div style="padding:40px; text-align:center;" class="text-muted">Loading tickets...</div>
        } @else {
          <div class="table-container" style="border:none; border-radius:0; margin:0;">
            <table class="table">
              <thead>
                <tr>
                  <th>Ticket Code</th>
                  <th>Display Code</th>
                  <th>Event ID</th>
                  <th>Owner ID</th>
                  <th>Status</th>
                  <th>Checked In At</th>
                  <th>Issued At</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (ticket of tickets(); track ticket.id) {
                  <tr>
                    <td><span class="order-id" style="font-family:monospace; font-size:13px; color:var(--color-primary);">{{ ticket.ticketCode }}</span></td>
                    <td>{{ ticket.displayCode || '—' }}</td>
                    <td><span class="text-muted" style="font-family:monospace; font-size:12px;">{{ ticket.eventId }}</span></td>
                    <td><span class="text-muted" style="font-family:monospace; font-size:12px;">{{ ticket.userId }}</span></td>
                    <td>
                      <span class="badge" [ngClass]="getStatusClass(ticket.status)">
                        {{ getStatusLabel(ticket.status) }}
                      </span>
                    </td>
                    <td class="text-sm text-muted">{{ formatDate(ticket.checkedInAt) }}</td>
                    <td class="text-sm text-muted">{{ formatDate(ticket.issuedAt) }}</td>
                    <td style="text-align:right;">
                      @if (ticket.status === 'valid') {
                        <button class="btn btn-sm btn-danger" (click)="cancelTicket(ticket)">Cancel</button>
                      } @else {
                        <span class="text-muted text-xs">—</span>
                      }
                    </td>
                  </tr>
                }
                @if (tickets().length === 0) {
                  <tr>
                    <td colspan="8" style="text-align:center; padding:48px; color:var(--color-text-muted);">
                      No tickets found.
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
export class Tickets implements OnInit {
  private ticketsSvc = inject(TicketsService);

  tickets = signal<UserTicketDoc[]>([]);
  loading = signal(true);
  hasMore = signal(false);
  lastDoc: any = null;

  // Search & Filter
  searchCode = '';
  selectedStatus = '';

  ngOnInit(): void {
    this.loadTickets();
  }

  async loadTickets(append = false): Promise<void> {
    this.loading.set(!append);
    try {
      const res = await this.ticketsSvc.getTickets({
        pageSize: 20,
        status: this.selectedStatus || undefined,
        ticketCode: this.searchCode.trim() || undefined,
        cursor: append ? this.lastDoc : undefined,
      });

      if (append) {
        this.tickets.update((prev) => [...prev, ...res.items]);
      } else {
        this.tickets.set(res.items);
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
      this.loadTickets(true);
    }
  }

  async cancelTicket(ticket: UserTicketDoc): Promise<void> {
    if (!confirm(`Are you sure you want to cancel and void ticket ${ticket.ticketCode}?`)) {
      return;
    }
    try {
      await this.ticketsSvc.cancelTicket(ticket.id);
      this.tickets.update((list) =>
        list.map((t) => (t.id === ticket.id ? { ...t, status: 'cancelled' as const } : t))
      );
    } catch (err) {
      alert('Error cancelling ticket: ' + err);
    }
  }

  formatDate(ts: any): string {
    if (!ts) return '—';
    const d = ts instanceof Timestamp ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      valid: 'badge-completed',
      used: 'badge-pending',
      expired: 'badge-gray',
      transferred: 'badge-info',
      cancelled: 'badge-refunded',
    };
    return map[status] ?? 'badge-gray';
  }

  getStatusLabel(status: string): string {
    return status.toUpperCase();
  }
}
