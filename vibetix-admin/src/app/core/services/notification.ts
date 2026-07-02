import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  toasts = signal<Toast[]>([]);
  private nextId = 0;

  show(type: Toast['type'], title: string, message?: string, durationMs = 4000): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, type, title, message }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  success(title: string, message?: string) { this.show('success', title, message); }
  error(title: string, message?: string) { this.show('error', title, message); }
  warning(title: string, message?: string) { this.show('warning', title, message); }
  info(title: string, message?: string) { this.show('info', title, message); }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
