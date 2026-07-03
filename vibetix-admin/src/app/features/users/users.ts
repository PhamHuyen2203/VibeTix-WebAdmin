import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersService } from '../../core/services/users.service';
import { AdminFunctions } from '../../core/services/admin-functions';
import { NotificationService } from '../../core/services/notification';
import { UserProfile, UserStatus } from '../../core/models/user.model';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, TitleCasePipe],
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
  filteredUsers = signal<UserProfile[]>([]);
  
  totalCount = this.userSvc.totalCount;
  activeCount = this.userSvc.activeCount;
  suspendedCount = this.userSvc.suspendedCount;
  organizerCount = this.userSvc.organizerCount;

  // Filters
  searchTerm = '';
  filterStatus: UserStatus | '' = '';
  filterRole = '';
  minSpent: number | null = null;

  // Pagination
  currentPage = signal(1);
  pageSize = signal(20);
  totalPages = signal(1);
  paginatedUsers = signal<UserProfile[]>([]);

  // Modals
  addModalOpen = signal(false);
  editModalOpen = signal(false);
  detailModalOpen = signal(false);
  selectedUser = signal<UserProfile | null>(null);
  showDeleteConfirmModal = signal(false);
  userToDelete = signal<UserProfile | null>(null);

  // Add User Form
  newUser = {
    email: '',
    password: '',
    fullName: '',
    phone: '',
  };

  // Edit User Form
  editUserForm = {
    email: '',
    fullName: '',
    phone: '',
  };

  async ngOnInit(): Promise<void> {
    await this.refreshAll();
  }

  async refreshAll(): Promise<void> {
    await Promise.all([
      this.userSvc.loadCounts(),
      this.loadUsers(),
    ]);
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    try {
      // Fetch up to 1000 users for complete client-side search/filtering
      const result = await this.userSvc.getUsers({
        pageSize: 1000,
      });
      this.users.set(result.items);
      this.currentPage.set(1);
      this.applyFilters();
    } finally {
      this.loading.set(false);
    }
  }

  applyFilters(): void {
    const term = this.searchTerm.toLowerCase().trim();
    const status = this.filterStatus;
    const role = this.filterRole;
    const spent = this.minSpent;

    let list = this.users();
    if (term) {
      list = list.filter((u) =>
        (u.displayName || '').toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term) ||
        (u.phoneNumber || '').toLowerCase().includes(term)
      );
    }
    if (status) {
      list = list.filter((u) => u.status === status);
    }
    if (role) {
      list = list.filter((u) => u.role === role);
    }
    if (spent !== null && spent !== undefined && spent >= 0) {
      list = list.filter((u) => (u.totalSpent ?? 0) >= spent);
    }
    this.filteredUsers.set(list);
    this.currentPage.set(1); // Reset to page 1 on filter
    this.updatePaginated();
  }

  updatePaginated(): void {
    const start = (this.currentPage() - 1) * this.pageSize();
    const end = start + this.pageSize();
    this.paginatedUsers.set(this.filteredUsers().slice(start, end));
    this.totalPages.set(Math.ceil(this.filteredUsers().length / this.pageSize()) || 1);
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
    const total = this.totalPages();
    const arr = [];
    for (let i = 1; i <= total; i++) {
      arr.push(i);
    }
    return arr;
  }

  openAddModal(): void {
    this.newUser = {
      email: '',
      password: '',
      fullName: '',
      phone: '',
    };
    this.addModalOpen.set(true);
  }

  async saveUser(): Promise<void> {
    if (!this.newUser.email || !this.newUser.password || !this.newUser.fullName) {
      alert('Email, password, and full name are required.');
      return;
    }
    this.loading.set(true);
    try {
      await this.adminFns.createUser({
        email: this.newUser.email,
        password: this.newUser.password,
        fullName: this.newUser.fullName,
        phone: this.newUser.phone || undefined,
      });
      this.addModalOpen.set(false);
      this.notif.success('User created successfully.');
      await this.refreshAll();
    } catch (err: any) {
      this.notif.error('Failed to create user: ' + (err.message || err));
    } finally {
      this.loading.set(false);
    }
  }

  viewDetails(user: UserProfile): void {
    this.selectedUser.set(user);
    this.detailModalOpen.set(true);
  }

  openEditModal(user: UserProfile): void {
    this.selectedUser.set(user);
    this.editUserForm = {
      email: user.email,
      fullName: user.displayName,
      phone: user.phoneNumber || '',
    };
    this.editModalOpen.set(true);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.filterStatus = '';
    this.filterRole = '';
    this.minSpent = null;
    this.applyFilters();
  }

  async updateUser(): Promise<void> {
    const user = this.selectedUser();
    if (!user) return;

    if (!this.editUserForm.email || !this.editUserForm.fullName) {
      this.notif.error('Email and full name are required.');
      return;
    }

    this.loading.set(true);
    try {
      await this.adminFns.editUser({
        userId: user.uid,
        email: this.editUserForm.email,
        fullName: this.editUserForm.fullName,
        phone: this.editUserForm.phone || undefined,
      });
      this.editModalOpen.set(false);
      this.notif.success('User updated successfully.');
      await this.refreshAll();
    } catch (err: any) {
      this.notif.error('Failed to update user: ' + (err.message || err));
    } finally {
      this.loading.set(false);
    }
  }

  deleteUser(user: UserProfile): void {
    this.userToDelete.set(user);
    this.showDeleteConfirmModal.set(true);
  }

  async confirmDeleteUser(): Promise<void> {
    const user = this.userToDelete();
    if (!user) return;
    this.showDeleteConfirmModal.set(false);
    this.actionLoading.set(user.uid + '_delete');
    try {
      await this.adminFns.deleteUser(user.uid);
      this.notif.success('User deleted successfully.');
      await this.refreshAll();
      this.userToDelete.set(null);
    } catch (err: any) {
      this.notif.error('Failed to delete user: ' + (err.message || err));
    } finally {
      this.actionLoading.set(null);
    }
  }

  async disableUser(user: UserProfile): Promise<void> {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    this.actionLoading.set(user.uid);
    try {
      await this.adminFns.updateUserStatus(user.uid, newStatus);
      
      // Update local states
      this.users.update((list) =>
        list.map((u) => (u.uid === user.uid ? { ...u, status: newStatus as UserStatus } : u))
      );
      this.applyFilters();
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

  triggerPrint(): void {
    window.print();
  }

  formatDate(ts: any): string {
    if (!ts) return '—';
    try {
      const d = ts instanceof Timestamp ? ts.toDate() : (typeof ts === 'string' || typeof ts === 'number' ? new Date(ts) : ts);
      if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
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

  getPageStart(): number {
    if (this.filteredUsers().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  }

  getPageEnd(): number {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredUsers().length);
  }
}
