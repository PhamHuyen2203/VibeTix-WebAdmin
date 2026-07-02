import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  private auth = inject(AuthService);
  private router = inject(Router);

  adminProfile = this.auth.adminProfile;
  dropdownOpen = signal(false);
  notifCount = signal(3);

  toggleDropdown(): void {
    this.dropdownOpen.update((v) => !v);
  }

  closeDropdown(): void {
    this.dropdownOpen.set(false);
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
