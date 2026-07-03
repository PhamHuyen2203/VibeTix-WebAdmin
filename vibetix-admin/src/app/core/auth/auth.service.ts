import { Injectable, signal } from '@angular/core';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
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
        const data = await this.getAdminData(user.uid);
        if (data) {
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

  private async getAdminData(uid: string): Promise<Omit<AdminProfile, 'uid'> | null> {
    const adminsRef = collection(firebaseDb, COLLECTIONS.admins);
    const q = query(adminsRef, where('user_id', '==', uid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const data = querySnapshot.docs[0].data();
    return {
      email: data['email'],
      displayName: data['full_name'] || data['displayName'] || 'Admin',
      photoURL: data['photoURL'] || '',
      role: (data['role'] === 'superadmin' ? 'superAdmin' : data['role']) as any,
      createdAt: data['created_at']?.toDate() || data['createdAt']?.toDate() || new Date(),
    };
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

    const data = await this.getAdminData(credential.user.uid);

    if (!data) {
      await signOut(firebaseAuth);
      throw new Error('Tài khoản này không có quyền Admin.');
    }

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

  async updateAdminProfile(displayName: string, photoURL?: string): Promise<void> {
    const user = this.currentUser();
    if (!user) return;

    // Update Firebase Auth Profile
    await updateProfile(user, {
      displayName: displayName,
      ...(photoURL ? { photoURL } : {})
    });

    // Update Firestore Document
    const adminsRef = collection(firebaseDb, COLLECTIONS.admins);
    const q = query(adminsRef, where('user_id', '==', user.uid));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      const docRef = snap.docs[0].ref;
      await updateDoc(docRef, {
        full_name: displayName,
        ...(photoURL ? { photoURL } : {})
      });
    }

    // Update Local Signal
    const currentProfile = this.adminProfile();
    if (currentProfile) {
      this.adminProfile.set({
        ...currentProfile,
        displayName: displayName,
        ...(photoURL ? { photoURL } : {})
      });
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(firebaseAuth, email);
  }
}