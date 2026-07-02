import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = signal('');
  password = signal('');
  rememberMe = signal(false);
  showPassword = signal(false);
  loading = signal(false);
  errorMessage = signal('');

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  async onSubmit(): Promise<void> {
    if (!this.email() || !this.password()) {
      this.errorMessage.set('Please enter your email and password.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      await this.auth.login(this.email(), this.password());
      await this.router.navigate(['/dashboard']);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      if (msg.includes('không có quyền Admin') || msg.includes('admin')) {
        this.errorMessage.set('This account does not have admin access.');
      } else if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        this.errorMessage.set('Invalid email or password.');
      } else {
        this.errorMessage.set('Login failed. Please try again.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
