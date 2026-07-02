import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { UsersService } from '../../core/services/users.service';
import { AdminFunctions } from '../../core/services/admin-functions';
import { NotificationService } from '../../core/services/notification';
import { UserProfile, UserStatus } from '../../core/models/user.model';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-users',
  imports: [FormsModule, TitleCasePipe],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users implements OnInit {
  private userSvc = inject(UsersService);
  private adminFns = inject(AdminFunctions);
  private notif = inject(NotificationService);

  loading = signal(true);
  actionLoading = signal<string | null>(null);

  users = signal<UserProfile[]>([]);
  totalCount = this.userSvc.totalCount;
  activeCount = this.userSvc.activeCount;
  suspendedCount = this.userSvc.suspendedCount;
  organizerCount = this.userSvc.organizerCount;

  // Filters
  searchTerm = '';
  filterRole = '';
  filterStatus: UserStatus | '' = '';

  // Pagination
  pageSize = 10;
  currentPage = 1;
  hasMore = signal(false);

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.userSvc.loadCounts(),
      this.loadUsers(),
    ]);
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.userSvc.getUsers({
        status: this.filterStatus,
        role: this.filterRole,
        pageSize: this.pageSize,
      });
      this.users.set(result.items);
      this.hasMore.set(result.hasMore);
      this.currentPage = 1;
    } finally {
      this.loading.set(false);
    }
  }

  async applyFilters(): Promise<void> {
    await this.loadUsers();
  }

  async disableUser(user: UserProfile): Promise<void> {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    this.actionLoading.set(user.uid);
    try {
      await this.adminFns.updateUserStatus(user.uid, newStatus);
      this.users.update((list) =>
        list.map((u) => (u.uid === user.uid ? { ...u, status: newStatus as UserStatus } : u))
      );
      this.notif.success(`User ${newStatus === 'disabled' ? 'disabled' : 'enabled'} successfully.`);
    } catch {
      this.notif.error('Failed to update user status.');
    } finally {
      this.actionLoading.set(null);
    }
  }

  async resetPassword(user: UserProfile): Promise<void> {
    this.actionLoading.set(user.uid + '_reset');
    try {
      await this.adminFns.resetUserPassword(user.uid);
      this.notif.success('Password reset email sent to ' + user.email);
    } catch {
      this.notif.error('Failed to send password reset.');
    } finally {
      this.actionLoading.set(null);
    }
  }

  formatDate(ts: Timestamp | Date | undefined): string {
    if (!ts) return '—';
    const d = ts instanceof Timestamp ? ts.toDate() : ts;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getStatusClass(status: UserStatus): string {
    const map: Record<UserStatus, string> = {
      active: 'badge-active',
      inactive: 'badge-inactive',
      suspended: 'badge-suspended',
      disabled: 'badge-suspended',
    };
    return map[status] ?? 'badge-gray';
  }

  getRoleClass(role: string): string {
    const map: Record<string, string> = {
      user: 'badge-gray',
      organizer: 'badge-info',
      admin: 'badge-primary',
    };
    return map[role] ?? 'badge-gray';
  }

  getInitials(name: string): string {
    return name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';
  }
}
