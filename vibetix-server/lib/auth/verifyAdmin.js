"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTIONS = exports.auth = exports.db = exports.admin = void 0;
exports.verifyAdmin = verifyAdmin;
exports.writeAuditLog = writeAuditLog;
const admin = __importStar(require("firebase-admin"));
exports.admin = admin;
const https_1 = require("firebase-functions/v2/https");
admin.initializeApp();
const db = admin.firestore();
exports.db = db;
const auth = admin.auth();
exports.auth = auth;
const COLLECTIONS = {
    admins: 'admins',
    users: 'users',
    organizers: 'organizers',
    events: 'events',
    orders: 'orders',
    tickets: 'user_tickets',
    payments: 'payments',
    discounts: 'discounts',
    auditLogs: 'audit_logs',
};
exports.COLLECTIONS = COLLECTIONS;
// ─── Shared Admin Verification ──────────────────────────────────────
async function verifyAdmin(request) {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    const uid = request.auth.uid;
    const adminDoc = await db.collection(COLLECTIONS.admins).doc(uid).get();
    if (!adminDoc.exists) {
        throw new https_1.HttpsError('permission-denied', 'Admin privileges required.');
    }
    const data = adminDoc.data();
    if (data['status'] && data['status'] !== 'active') {
        throw new https_1.HttpsError('permission-denied', 'Admin account is not active.');
    }
    return {
        uid,
        displayName: data['displayName'] ?? 'Admin',
        role: data['role'] ?? 'admin',
    };
}
// ─── Audit Log Helper ────────────────────────────────────────────────
async function writeAuditLog(adminUid, adminName, action, targetType, targetId, details) {
    await db.collection(COLLECTIONS.auditLogs).add({
        adminUid,
        adminName,
        action,
        targetType,
        targetId,
        details: details ?? {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
//# sourceMappingURL=verifyAdmin.js.map