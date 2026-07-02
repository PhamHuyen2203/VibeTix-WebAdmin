import { Injectable, signal } from '@angular/core';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from '../firebase/firebase.client';
import { COLLECTIONS } from '../firebase/collections';

export interface AdminProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'superAdmin' | 'moderator' | 'admin';
  createdAt?: Date;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  currentUser = signal<User | null>(null);
  adminProfile = signal<AdminProfile | null>(null);
  isAdmin = signal(false);
  loading = signal(true);

  private authInitPromise: Promise<void>;
  private resolveAuthInit!: () => void;

  constructor() {
    this.authInitPromise = new Promise<void>((resolve) => {
      this.resolveAuthInit = resolve;
    });

    onAuthStateChanged(firebaseAuth, async (user) => {
      this.currentUser.set(user);

      if (!user) {
        this.isAdmin.set(false);
        this.adminProfile.set(null);
        this.loading.set(false);
        this.resolveAuthInit();
        return;
      }

      try {
        const adminRef = doc(firebaseDb, COLLECTIONS.admins, user.uid);
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists()) {
          const data = adminSnap.data() as Omit<AdminProfile, 'uid'>;
          this.adminProfile.set({ uid: user.uid, ...data });
          this.isAdmin.set(true);
        } else {
          this.isAdmin.set(false);
          this.adminProfile.set(null);
        }
      } catch {
        this.isAdmin.set(false);
        this.adminProfile.set(null);
      }

      this.loading.set(false);
      this.resolveAuthInit();
    });
  }

  /** Awaitable promise that resolves once the initial auth state is known. */
  waitForAuthInit(): Promise<void> {
    return this.authInitPromise;
  }

  async login(email: string, password: string): Promise<void> {
    const credential = await signInWithEmailAndPassword(
      firebaseAuth,
      email,
      password,
    );

    const adminRef = doc(firebaseDb, COLLECTIONS.admins, credential.user.uid);
    const adminSnap = await getDoc(adminRef);

    if (!adminSnap.exists()) {
      await signOut(firebaseAuth);
      throw new Error('Tài khoản này không có quyền Admin.');
    }

    const data = adminSnap.data() as Omit<AdminProfile, 'uid'>;
    this.currentUser.set(credential.user);
    this.adminProfile.set({ uid: credential.user.uid, ...data });
    this.isAdmin.set(true);
  }

  async logout(): Promise<void> {
    await signOut(firebaseAuth);
    this.currentUser.set(null);
    this.adminProfile.set(null);
    this.isAdmin.set(false);
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(firebaseAuth, email);
  }
}