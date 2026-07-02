import { Injectable, signal } from '@angular/core';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from '../firebase/firebase.client';
import { COLLECTIONS } from '../firebase/collections';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  currentUser = signal<User | null>(null);
  isAdmin = signal(false);
  loading = signal(true);

  constructor() {
    onAuthStateChanged(firebaseAuth, async (user) => {
      this.currentUser.set(user);

      if (!user) {
        this.isAdmin.set(false);
        this.loading.set(false);
        return;
      }

      const adminRef = doc(firebaseDb, COLLECTIONS.admins, user.uid);
      const adminSnap = await getDoc(adminRef);

      this.isAdmin.set(adminSnap.exists());
      this.loading.set(false);
    });
  }

  async login(email: string, password: string): Promise<void> {
    const credential = await signInWithEmailAndPassword(
      firebaseAuth,
      email,
      password
    );

    const adminRef = doc(firebaseDb, COLLECTIONS.admins, credential.user.uid);
    const adminSnap = await getDoc(adminRef);

    if (!adminSnap.exists()) {
      await signOut(firebaseAuth);
      throw new Error('Tài khoản này không có quyền Admin.');
    }

    this.currentUser.set(credential.user);
    this.isAdmin.set(true);
  }

  async logout(): Promise<void> {
    await signOut(firebaseAuth);
  }
}