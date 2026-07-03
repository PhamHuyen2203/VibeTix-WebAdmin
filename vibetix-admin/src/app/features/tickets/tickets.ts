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
      <div class="filter-bar">
        <div class="form-control-icon" style="flex:1;max-width:300px;position:relative;">
          <span class="icon-left" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);display:flex;color:var(--color-text-muted);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input type="search" class="form-control input-search" style="padding-left:34px;height:36px;" placeholder="Search Ticket Code or User ID..." [(ngModel)]="searchCode" (input)="applyFilters()" />
        </div>
        <select class="form-control" style="width:150px;height:36px;" [(ngModel)]="selectedStatus" (change)="applyFilters()">
          <option value="">All Statuses</option>
          <option value="valid">Valid</option>
          <option value="used">Used</option>
          <option value="expired">Expired</option>
          <option value="transferred">Transferred</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button class="btn btn-ghost btn-sm" (click)="resetFilters()">Clear Filters</button>
      </div>

      <!-- Table Card -->
      <div class="card" style="padding:0;overflow:hidden;">
        @if (loading()) {
          <div style="padding:40px; text-align:center;" class="text-muted">Loading tickets...</div>
        } @else {
          <div class="table-container" style="border:none; border-radius:0; margin:0; box-shadow:none;">
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
                @for (ticket of paginatedTickets; track ticket.id) {
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
                      <div class="action-row" style="justify-content:flex-end;">
                        <button class="btn btn-sm btn-ghost" (click)="viewDetails(ticket)">Details</button>
                        @if (ticket.status === 'valid') {
                          <button class="btn btn-sm btn-ghost text-error" (click)="confirmCancel(ticket)">Cancel</button>
                        }
                      </div>
                    </td>
                  </tr>
                }
                @if (filteredTickets().length === 0) {
                  <tr>
                    <td colspan="8" style="text-align:center; padding:48px; color:var(--color-text-muted);">
                      No tickets found matching filters.
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
            <h3>Ticket Details</h3>
            <button class="btn-icon" (click)="detailModalOpen.set(false)">×</button>
          </div>
          <div class="modal-body">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
              <div>
                <span class="text-xs text-muted">TICKET CODE</span>
                <p class="font-semibold" style="font-family:monospace;">{{ selectedTicket()?.ticketCode }}</p>
              </div>
              <div>
                <span class="text-xs text-muted">STATUS</span>
                <div>
                  <span class="badge" [ngClass]="getStatusClass(selectedTicket()?.status || 'valid')">
                    {{ getStatusLabel(selectedTicket()?.status || 'valid') }}
                  </span>
                </div>
              </div>
              <div>
                <span class="text-xs text-muted">CUSTOMER UID</span>
                <p style="font-family:monospace; font-size:12px;">{{ selectedTicket()?.userId }}</p>
              </div>
              <div>
                <span class="text-xs text-muted">EVENT ID</span>
                <p style="font-family:monospace; font-size:12px;">{{ selectedTicket()?.eventId }}</p>
              </div>
              <div>
                <span class="text-xs text-muted">ISSUED AT</span>
                <p>{{ formatDate(selectedTicket()?.issuedAt) }}</p>
              </div>
              <div>
                <span class="text-xs text-muted">CHECKED IN</span>
                <p>{{ formatDate(selectedTicket()?.checkedInAt) }}</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" (click)="detailModalOpen.set(false)">Close</button>
          </div>
        </div>
      </div>
    }

    <!-- Confirm Modal -->
    @if (confirmModalOpen()) {
      <div class="modal-backdrop" style="z-index: 1050;">
        <div class="modal-card" style="max-width:400px; text-align:center; padding: 24px;">
          <h3 style="margin-bottom:12px; color:var(--color-error);">Cancel Ticket</h3>
          <p style="margin-bottom:24px; color:var(--color-text-muted);">
            Are you sure you want to cancel and void ticket <strong style="color:var(--color-text);">{{ ticketToCancel()?.ticketCode }}</strong>?<br/>
            This action cannot be undone.
          </p>
          <div style="display:flex; justify-content:center; gap:12px;">
            <button class="btn btn-outline" (click)="confirmModalOpen.set(false)">No, Keep It</button>
            <button class="btn btn-danger" (click)="executeCancel()">Yes, Cancel It</button>
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
export class Tickets implements OnInit {
  private ticketsSvc = inject(TicketsService);

  tickets = signal<UserTicketDoc[]>([]);
  filteredTickets = signal<UserTicketDoc[]>([]);
  loading = signal(true);

  // Pagination
  currentPage = signal(1);
  pageSize = signal(20);

  // Search & Filter
  searchCode = '';
  selectedStatus = '';

  // Modals
  detailModalOpen = signal(false);
  selectedTicket = signal<UserTicketDoc | null>(null);

  confirmModalOpen = signal(false);
  ticketToCancel = signal<UserTicketDoc | null>(null);

  // Computed Pagination Properties
  get paginatedTickets(): UserTicketDoc[] {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredTickets().slice(start, start + this.pageSize());
  }

  get totalPages(): number {
    return Math.ceil(this.filteredTickets().length / this.pageSize()) || 1;
  }

  getPageStart(): number {
    if (this.filteredTickets().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  }

  getPageEnd(): number {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredTickets().length);
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
    this.loadTickets();
  }

  async loadTickets(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.ticketsSvc.getTickets({
        pageSize: 1000,
      });

      this.tickets.set(res.items);
      this.applyFilters();
    } catch (err) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  applyFilters(): void {
    let list = this.tickets();

    if (this.searchCode.trim()) {
      const term = this.searchCode.toLowerCase().trim();
      list = list.filter((t) => (t.ticketCode || '').toLowerCase().includes(term) || (t.userId || '').toLowerCase().includes(term));
    }

    if (this.selectedStatus) {
      list = list.filter((t) => t.status === this.selectedStatus);
    }

    // Sort newest first
    list.sort((a, b) => {
      const dateA = a.issuedAt instanceof Timestamp ? a.issuedAt.toDate().getTime() : (a.issuedAt ? new Date(a.issuedAt).getTime() : 0);
      const dateB = b.issuedAt instanceof Timestamp ? b.issuedAt.toDate().getTime() : (b.issuedAt ? new Date(b.issuedAt).getTime() : 0);
      return dateB - dateA;
    });

    this.filteredTickets.set(list);
    this.currentPage.set(1);
  }

  resetFilters(): void {
    this.searchCode = '';
    this.selectedStatus = '';
    this.applyFilters();
  }

  viewDetails(ticket: UserTicketDoc): void {
    this.selectedTicket.set(ticket);
    this.detailModalOpen.set(true);
  }

  confirmCancel(ticket: UserTicketDoc): void {
    this.ticketToCancel.set(ticket);
    this.confirmModalOpen.set(true);
  }

  async executeCancel(): Promise<void> {
    const ticket = this.ticketToCancel();
    if (!ticket) return;
    
    try {
      await this.ticketsSvc.cancelTicket(ticket.id);
      this.tickets.update((list) =>
        list.map((t) => (t.id === ticket.id ? { ...t, status: 'cancelled' as const } : t))
      );
      this.applyFilters();
    } catch (err) {
      alert('Error cancelling ticket: ' + err);
    } finally {
      this.confirmModalOpen.set(false);
      this.ticketToCancel.set(null);
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
