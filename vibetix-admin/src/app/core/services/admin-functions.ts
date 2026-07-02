import { Injectable } from '@angular/core';
import {
  getFunctions,
  httpsCallable,
  HttpsCallableResult,
} from 'firebase/functions';
import { firebaseApp } from '../firebase/firebase.client';

@Injectable({
  providedIn: 'root',
})
export class AdminFunctions {
  private functions = getFunctions(firebaseApp, 'asia-southeast1');

  /**
   * Generic typed callable helper.
   * All Cloud Functions must be HTTPS Callable and enforce auth + admin check internally.
   */
  async call<Req, Res>(
    functionName: string,
    payload: Req,
  ): Promise<Res> {
    const fn = httpsCallable<Req, Res>(this.functions, functionName);
    const result: HttpsCallableResult<Res> = await fn(payload);
    return result.data;
  }

  // ─── Organizer Actions ────────────────────────────────────────────
  approveOrganizer(organizerId: string) {
    return this.call<{ organizerId: string }, { success: boolean }>(
      'approveOrganizer',
      { organizerId },
    );
  }

  rejectOrganizer(organizerId: string, reason: string) {
    return this.call<{ organizerId: string; reason: string }, { success: boolean }>(
      'rejectOrganizer',
      { organizerId, reason },
    );
  }

  suspendOrganizer(organizerId: string, reason: string) {
    return this.call<{ organizerId: string; reason: string }, { success: boolean }>(
      'suspendOrganizer',
      { organizerId, reason },
    );
  }

  // ─── Event Actions ────────────────────────────────────────────────
  approveEvent(eventId: string) {
    return this.call<{ eventId: string }, { success: boolean }>(
      'approveEvent',
      { eventId },
    );
  }

  rejectEvent(eventId: string, reason: string) {
    return this.call<{ eventId: string; reason: string }, { success: boolean }>(
      'rejectEvent',
      { eventId, reason },
    );
  }

  featureEvent(eventId: string, featured: boolean) {
    return this.call<{ eventId: string; featured: boolean }, { success: boolean }>(
      'featureEvent',
      { eventId, featured },
    );
  }

  cancelEvent(eventId: string, reason: string) {
    return this.call<{ eventId: string; reason: string }, { success: boolean }>(
      'cancelEvent',
      { eventId, reason },
    );
  }

  // ─── User Actions ─────────────────────────────────────────────────
  updateUserStatus(userId: string, status: 'active' | 'disabled' | 'suspended') {
    return this.call<{ userId: string; status: string }, { success: boolean }>(
      'updateUserStatus',
      { userId, status },
    );
  }

  resetUserPassword(userId: string) {
    return this.call<{ userId: string }, { success: boolean }>(
      'resetUserPassword',
      { userId },
    );
  }
}
