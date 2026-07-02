import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { firebaseDb } from '../../core/firebase/firebase.client';

export interface DbNotification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: any;
}

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  adminProfile = this.auth.adminProfile;
  dropdownOpen = signal(false);

  // DB Notifications
  notifDropdownOpen = signal(false);
  dbNotifications = signal<DbNotification[]>([]);
  unreadCount = signal(0);

  async ngOnInit(): Promise<void> {
    await this.loadNotifications();
  }

  async loadNotifications(): Promise<void> {
    try {
      const col = collection(firebaseDb, 'notifications');
      const q = query(col, orderBy('created_at', 'desc'), limit(20));
      const snap = await getDocs(q);
      const items: DbNotification[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data['title'] || 'System Alert',
          body: data['body'] || '',
          isRead: data['is_read'] ?? data['isRead'] ?? false,
          createdAt: data['created_at'] || data['createdAt'] || new Date(),
        };
      });
      this.dbNotifications.set(items);
      this.unreadCount.set(items.filter((n) => !n.isRead).length);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }

  toggleDropdown(): void {
    this.dropdownOpen.update((v) => !v);
  }

  closeDropdown(): void {
    this.dropdownOpen.set(false);
  }

  toggleNotifDropdown(): void {
    this.notifDropdownOpen.update((v) => !v);
  }

  closeNotifDropdown(): void {
    this.notifDropdownOpen.set(false);
  }

  async markAsRead(notif: DbNotification): Promise<void> {
    if (notif.isRead) return;
    try {
      const ref = doc(firebaseDb, 'notifications', notif.id);
      await updateDoc(ref, { is_read: true });
      this.dbNotifications.update((list) =>
        list.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      this.unreadCount.update((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  }

  async markAllAsRead(): Promise<void> {
    const unread = this.dbNotifications().filter((n) => !n.isRead);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(firebaseDb);
      unread.forEach((n) => {
        const ref = doc(firebaseDb, 'notifications', n.id);
        batch.update(ref, { is_read: true });
      });
      await batch.commit();
      this.dbNotifications.update((list) => list.map((n) => ({ ...n, isRead: true })));
      this.unreadCount.set(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  }

  formatNotifDate(createdAt: any): string {
    if (!createdAt) return '—';
    const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async logout(): Promise<void> {
    this.closeDropdown();
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  getInitials(name: string | undefined): string {
    if (!name) return 'A';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
