import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { collection, getDocs, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { firebaseDb } from '../../core/firebase/firebase.client';
import { COLLECTIONS } from '../../core/firebase/collections';

interface AdminDoc {
  id: string;
  email: string;
  role: 'admin' | 'superAdmin';
  user_id: string;
  full_name?: string;
  created_at?: any;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrapper">
      <div class="breadcrumb">
        <span>Dashboard</span>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">Settings</span>
      </div>

      <div class="page-header">
        <div>
          <h1 class="page-title">Settings & Configuration</h1>
          <p class="page-subtitle">Configure system parameters and manage administrator permissions.</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; flex-wrap:wrap;">
        <!-- Administrator Accounts -->
        <div class="card" style="padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <p class="card-title" style="margin:0;">Administrators</p>
            <button class="btn btn-primary btn-sm" (click)="openAddModal()">Add Admin</button>
          </div>

          <div class="table-container" style="border:none;">
            <table class="table" style="font-size:13px;">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>User ID</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (admin of admins(); track admin.id) {
                  <tr>
                    <td class="font-semibold">{{ admin.email }}</td>
                    <td>
                      <span class="badge" [class.badge-completed]="admin.role === 'superAdmin'" [class.badge-info]="admin.role === 'admin'">
                        {{ admin.role }}
                      </span>
                    </td>
                    <td><span class="text-muted" style="font-family:monospace; font-size:12px;">{{ admin.user_id }}</span></td>
                    <td style="text-align:right;">
                      @if (admin.role !== 'superAdmin') {
                        <button class="btn btn-sm btn-danger" (click)="confirmRemove(admin)">Remove</button>
                      } @else {
                        <span class="text-muted">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- System Settings -->
        <div class="card" style="padding:20px;">
          <p class="card-title mb-3">System Properties</p>
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border); padding-bottom:12px;">
              <div>
                <p class="font-semibold" style="margin:0;">Firebase Project ID</p>
                <p class="text-xs text-muted" style="margin:0;">Active database target</p>
              </div>
              <span class="badge badge-info" style="font-family:monospace;">mobile-5f256</span>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border); padding-bottom:12px;">
              <div>
                <p class="font-semibold" style="margin:0;">Cloud Functions Region</p>
                <p class="text-xs text-muted" style="margin:0;">Endpoint regional location</p>
              </div>
              <span class="badge badge-info" style="font-family:monospace;">asia-southeast1</span>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <p class="font-semibold" style="margin:0;">Maintenance Mode</p>
                <p class="text-xs text-muted" style="margin:0;">Restrict client application access</p>
              </div>
              <label class="switch">
                <input
                  type="checkbox"
                  [checked]="maintenanceMode()"
                  (change)="toggleMaintenance()"
                />
                <span class="slider round"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Admin Modal -->
    @if (addModalOpen()) {
      <div class="modal-backdrop">
        <div class="modal-card" style="max-width:440px;">
          <div class="modal-header">
            <h3>Add New Administrator</h3>
            <button class="btn-icon" (click)="addModalOpen.set(false)">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group mb-3">
              <label>Auth User ID (UID)</label>
              <input type="text" class="form-control" placeholder="Firebase Auth UID" [(ngModel)]="newAdmin.user_id" />
            </div>
            <div class="form-group mb-3">
              <label>Email Address</label>
              <input type="email" class="form-control" placeholder="E.g. admin@example.com" [(ngModel)]="newAdmin.email" />
            </div>
            <div class="form-group mb-3">
              <label>Full Name</label>
              <input type="text" class="form-control" placeholder="E.g. Pham Huyen" [(ngModel)]="newAdmin.full_name" />
            </div>
            <div class="form-group">
              <label>Role</label>
              <select class="form-control" [(ngModel)]="newAdmin.role">
                <option value="admin">Admin</option>
                <option value="superAdmin">Super Admin</option>
              </select>
            </div>
          </div>
          <div class="modal-footer" style="display:flex; justify-content:end; gap:8px;">
            <button class="btn btn-outline" (click)="addModalOpen.set(false)">Cancel</button>
            <button class="btn btn-primary" (click)="saveAdmin()">Add Administrator</button>
          </div>
        </div>
      </div>
    }

    <!-- Confirm Remove Modal -->
    @if (confirmModalOpen()) {
      <div class="modal-backdrop" style="z-index: 1050;">
        <div class="modal-card" style="max-width:400px; text-align:center; padding: 24px;">
          <h3 style="margin-bottom:12px; color:var(--color-error);">Remove Administrator</h3>
          <p style="margin-bottom:24px; color:var(--color-text-muted);">
            Are you sure you want to remove administrator <strong style="color:var(--color-text);">{{ adminToRemove()?.email }}</strong>?<br/>
            This action cannot be undone.
          </p>
          <div style="display:flex; justify-content:center; gap:12px;">
            <button class="btn btn-outline" (click)="confirmModalOpen.set(false)">Cancel</button>
            <button class="btn btn-danger" (click)="executeRemove()">Yes, Remove</button>
          </div>
        </div>
      </div>
    }

    <!-- Alert Modal -->
    @if (alertModalOpen()) {
      <div class="modal-backdrop" style="z-index: 1060;">
        <div class="modal-card" style="max-width:400px; text-align:center; padding: 24px;">
          <h3 style="margin-bottom:12px;" [style.color]="alertIsError() ? 'var(--color-error)' : 'var(--color-success)'">
            {{ alertIsError() ? 'Error' : 'Notification' }}
          </h3>
          <p style="margin-bottom:24px; color:var(--color-text-muted);">
            {{ alertMessage() }}
          </p>
          <div style="display:flex; justify-content:center;">
            <button class="btn btn-primary" (click)="alertModalOpen.set(false)">OK</button>
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
    }
    .switch {
      position: relative;
      display: inline-block;
      width: 46px;
      height: 22px;
    }
    .switch input { 
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: #ccc;
      transition: .4s;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .4s;
    }
    input:checked + .slider {
      background-color: var(--color-primary);
    }
    input:checked + .slider:before {
      transform: translateX(24px);
    }
    .slider.round {
      border-radius: 34px;
    }
    .slider.round:before {
      border-radius: 50%;
    }
  `]
})
export class Settings implements OnInit {
  admins = signal<AdminDoc[]>([]);
  maintenanceMode = signal(false);
  addModalOpen = signal(false);

  newAdmin = {
    email: '',
    role: 'admin' as const,
    user_id: '',
    full_name: '',
  };

  confirmModalOpen = signal(false);
  adminToRemove = signal<AdminDoc | null>(null);

  alertModalOpen = signal(false);
  alertMessage = signal('');
  alertIsError = signal(false);

  showAlert(msg: string, isError = false): void {
    this.alertMessage.set(msg);
    this.alertIsError.set(isError);
    this.alertModalOpen.set(true);
  }

  ngOnInit(): void {
    this.loadAdmins();
  }

  async loadAdmins(): Promise<void> {
    try {
      const snap = await getDocs(collection(firebaseDb, COLLECTIONS.admins));
      this.admins.set(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            email: data['email'] || '',
            role: data['role'] || 'admin',
            user_id: data['user_id'] || '',
            full_name: data['full_name'] || '',
            created_at: data['created_at'],
          };
        })
      );
    } catch (err) {
      console.error(err);
    }
  }

  openAddModal(): void {
    this.newAdmin = {
      email: '',
      role: 'admin',
      user_id: '',
      full_name: '',
    };
    this.addModalOpen.set(true);
  }

  async saveAdmin(): Promise<void> {
    if (!this.newAdmin.email || !this.newAdmin.user_id) {
      this.showAlert('Email and User ID are required.', true);
      return;
    }
    try {
      // Document ID can be random or matching user_id
      const id = doc(collection(firebaseDb, COLLECTIONS.admins)).id;
      await setDoc(doc(firebaseDb, COLLECTIONS.admins, id), {
        email: this.newAdmin.email.trim(),
        role: this.newAdmin.role,
        user_id: this.newAdmin.user_id.trim(),
        full_name: this.newAdmin.full_name.trim(),
        created_at: Timestamp.now(),
      });
      this.addModalOpen.set(false);
      this.loadAdmins();
    } catch (err) {
      this.showAlert('Error adding admin: ' + err, true);
    }
  }

  confirmRemove(admin: AdminDoc): void {
    this.adminToRemove.set(admin);
    this.confirmModalOpen.set(true);
  }

  async executeRemove(): Promise<void> {
    const admin = this.adminToRemove();
    if (!admin) return;
    
    try {
      await deleteDoc(doc(firebaseDb, COLLECTIONS.admins, admin.id));
      this.admins.update((list) => list.filter((a) => a.id !== admin.id));
    } catch (err) {
      this.showAlert('Error removing admin: ' + err, true);
    } finally {
      this.confirmModalOpen.set(false);
      this.adminToRemove.set(null);
    }
  }

  toggleMaintenance(): void {
    this.maintenanceMode.update((v) => !v);
  }
}
