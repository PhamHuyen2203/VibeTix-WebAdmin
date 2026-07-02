import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Header } from '../header/header';
import { NotificationService } from '../../core/services/notification';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, Sidebar, Header],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
  notif = inject(NotificationService);
  toasts = this.notif.toasts;

  dismissToast(id: number): void {
    this.notif.dismiss(id);
  }
}
