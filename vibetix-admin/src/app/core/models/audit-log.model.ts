import { Timestamp } from 'firebase/firestore';

export type AuditAction =
  | 'organizer.approve'
  | 'organizer.reject'
  | 'organizer.suspend'
  | 'event.approve'
  | 'event.reject'
  | 'event.cancel'
  | 'event.feature'
  | 'user.disable'
  | 'user.enable'
  | 'user.suspend'
  | 'user.reset_password'
  | 'promotion.create'
  | 'promotion.delete'
  | 'admin.login';

export type AuditTargetType =
  | 'organizer'
  | 'event'
  | 'user'
  | 'promotion'
  | 'order'
  | 'admin';

export interface AuditLog {
  id: string;
  adminUid: string;
  adminName?: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  targetName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Timestamp | Date;
}
