import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-forbidden',
  template: `
    <div class="forbidden-page">
      <img src="brand/mascot-vibetix.png" alt="VibeTix Mascot" class="forbidden-mascot" />
      <h1>Access Denied</h1>
      <p>Your account does not have admin privileges to access this page.</p>
      <div class="forbidden-actions">
        <button class="btn btn-primary" (click)="logout()">Sign in with a different account</button>
        <button class="btn btn-ghost" (click)="goBack()">Go back</button>
      </div>
    </div>
  `,
  styles: [`
    .forbidden-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 40px;
      text-align: center;
      background: var(--bg-page);
    }
    .forbidden-mascot { width: 120px; margin-bottom: 8px; }
    h1 { font-size: 28px; font-weight: 800; }
    p { color: var(--color-text-secondary); max-width: 320px; }
    .forbidden-actions { display: flex; gap: 12px; margin-top: 8px; }
  `],
  imports: [],
})
export class Forbidden {
  private auth = inject(AuthService);
  private router = inject(Router);

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  goBack(): void {
    history.back();
  }
}
