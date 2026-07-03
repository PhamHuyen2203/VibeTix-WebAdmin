import { Component, inject, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseDb, firebaseStorage } from '../../core/firebase/firebase.client';
import { COLLECTIONS } from '../../core/firebase/collections';

export interface DbNotification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: any;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, FormsModule],
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

  // Search
  searchTerm = '';
  searchDropdownOpen = signal(false);
  searchResults = signal<{type:string, title:string, subtitle:string, link:string}[]>([]);
  searchTimeout: any;

  // Profile Edit Modal
  editProfileModalOpen = signal(false);
  editDisplayName = '';
  selectedAvatarFile: File | null = null;
  avatarPreview = '';
  isSavingProfile = signal(false);

  // Camera
  isCameraOpen = signal(false);
  cameraStream: MediaStream | null = null;
  @ViewChild('cameraVideo') cameraVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('cameraCanvas') cameraCanvas!: ElementRef<HTMLCanvasElement>;

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

  async onSearch(): Promise<void> {
    if (!this.searchTerm.trim()) {
      this.searchResults.set([]);
      this.searchDropdownOpen.set(false);
      return;
    }
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      const term = this.searchTerm.toLowerCase();
      
      const adminFunctions = [
        { type: 'Page', title: 'Dashboard', subtitle: 'Overview and Statistics', link: '/dashboard' },
        { type: 'Page', title: 'Users', subtitle: 'Manage app users and attendees', link: '/users' },
        { type: 'Page', title: 'Organizers', subtitle: 'Manage event organizers', link: '/organizers' },
        { type: 'Page', title: 'Events', subtitle: 'Manage all events', link: '/events' },
        { type: 'Page', title: 'Orders', subtitle: 'Manage purchases and orders', link: '/orders' },
        { type: 'Page', title: 'Tickets', subtitle: 'Manage sold tickets', link: '/tickets' },
        { type: 'Page', title: 'Payments', subtitle: 'Manage payouts and transactions', link: '/payments' },
        { type: 'Page', title: 'Promotions', subtitle: 'Manage discount codes and promos', link: '/promotions' },
        { type: 'Page', title: 'Settings', subtitle: 'System properties and Admin roles', link: '/settings' },
      ];

      const results = adminFunctions.filter(f => 
        f.title.toLowerCase().includes(term) || f.subtitle.toLowerCase().includes(term)
      );

      this.searchResults.set(results.slice(0, 6));
      this.searchDropdownOpen.set(true);
    }, 100);
  }

  closeSearch(): void {
    setTimeout(() => this.searchDropdownOpen.set(false), 200);
  }

  openEditProfile(): void {
    this.editDisplayName = this.adminProfile()?.displayName || '';
    this.avatarPreview = this.adminProfile()?.photoURL || '';
    this.selectedAvatarFile = null;
    this.editProfileModalOpen.set(true);
    this.closeDropdown();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedAvatarFile = file;
      const reader = new FileReader();
      reader.onload = (e) => this.avatarPreview = e.target?.result as string;
      reader.readAsDataURL(file);
    }
  }

  async openCamera(): Promise<void> {
    try {
      this.isCameraOpen.set(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      this.cameraStream = stream;
      setTimeout(() => {
        if (this.cameraVideo?.nativeElement) {
          this.cameraVideo.nativeElement.srcObject = stream;
        }
      }, 0);
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('Could not access camera. Please check permissions.');
      this.isCameraOpen.set(false);
    }
  }

  capturePhoto(): void {
    if (!this.cameraVideo?.nativeElement || !this.cameraCanvas?.nativeElement) return;
    
    const video = this.cameraVideo.nativeElement;
    const canvas = this.cameraCanvas.nativeElement;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      this.avatarPreview = dataUrl;
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
          this.selectedAvatarFile = file;
        }
      }, 'image/jpeg');
    }
    
    this.closeCamera();
  }

  closeCamera(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    this.isCameraOpen.set(false);
  }

  closeEditProfileModal(): void {
    this.closeCamera();
    this.editProfileModalOpen.set(false);
  }

  async saveProfile(): Promise<void> {
    if (!this.editDisplayName.trim()) return;
    this.isSavingProfile.set(true);
    try {
      let photoURL = this.adminProfile()?.photoURL;
      
      if (this.selectedAvatarFile) {
        const ext = this.selectedAvatarFile.name.split('.').pop() || 'jpg';
        const storageRef = ref(firebaseStorage, `admins/${this.adminProfile()?.uid}/avatar_${Date.now()}.${ext}`);
        await uploadBytes(storageRef, this.selectedAvatarFile);
        photoURL = await getDownloadURL(storageRef);
      }

      await this.auth.updateAdminProfile(this.editDisplayName, photoURL);
      this.closeEditProfileModal();
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Error saving profile');
    } finally {
      this.isSavingProfile.set(false);
    }
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
