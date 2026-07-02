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

  editOrganizer(payload: {
    organizerId: string;
    brandName?: string;
    logoUrl?: string;
    description?: string;
    websiteUrl?: string;
    contactEmail?: string;
    contactPhone?: string;
  }) {
    return this.call<typeof payload, { success: boolean }>('editOrganizer', payload);
  }

  deleteOrganizer(organizerId: string) {
    return this.call<{ organizerId: string }, { success: boolean }>('deleteOrganizer', {
      organizerId,
    });
  }

  createOrganizer(payload: {
    brandName: string;
    contactEmail: string;
    contactPhone?: string;
    description?: string;
    websiteUrl?: string;
    logoUrl?: string;
    category?: string;
  }) {
    return this.call<typeof payload, { success: boolean; organizerId: string }>('createOrganizer', payload);
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

  createEvent(payload: {
    title: string;
    description?: string;
    organizerId: string;
    organizerName?: string;
    categoryId?: string;
    venueName?: string;
    venueAddress?: string;
    startTime?: string;
    endTime?: string;
    totalTickets?: number;
  }) {
    return this.call<typeof payload, { success: boolean; eventId: string }>('createEvent', payload);
  }

  editEvent(payload: {
    eventId: string;
    title?: string;
    description?: string;
    categoryId?: string;
    venueName?: string;
    venueAddress?: string;
    startTime?: string;
    endTime?: string;
    totalTickets?: number;
  }) {
    return this.call<typeof payload, { success: boolean }>('editEvent', payload);
  }

  deleteEvent(eventId: string) {
    return this.call<{ eventId: string }, { success: boolean }>('deleteEvent', { eventId });
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

  createUser(payload: { email: string; password?: string; fullName: string; phone?: string; avatarUrl?: string }) {
    return this.call<typeof payload, { success: boolean; userId: string }>(
      'createUser',
      payload
    );
  }

  editUser(payload: { userId: string; email?: string; fullName?: string; phone?: string; avatarUrl?: string }) {
    return this.call<typeof payload, { success: boolean }>(
      'editUser',
      payload
    );
  }

  deleteUser(userId: string) {
    return this.call<{ userId: string }, { success: boolean }>(
      'deleteUser',
      { userId }
    );
  }
}
