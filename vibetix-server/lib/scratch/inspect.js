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
const admin = __importStar(require("firebase-admin"));
// Initialize firebase admin, target local emulator if running
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
admin.initializeApp({
    projectId: 'mobile-5f256'
});
const db = admin.firestore();
async function run() {
    console.log('--- ORGANIZERS ---');
    const orgs = await db.collection('organizers').limit(5).get();
    orgs.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
    });
    console.log('--- EVENTS ---');
    const events = await db.collection('events').limit(5).get();
    events.forEach(doc => {
        console.log(doc.id, '=>', {
            event_id: doc.data().event_id,
            organizer_id: doc.data().organizer_id,
            title: doc.data().title
        });
    });
    console.log('--- ORDERS ---');
    const orders = await db.collection('orders').limit(5).get();
    orders.forEach(doc => {
        console.log(doc.id, '=>', {
            order_id: doc.data().order_id,
            user_id: doc.data().user_id,
            event_id: doc.data().event_id,
            total_amount: doc.data().total_amount,
            status: doc.data().status
        });
    });
    console.log('--- USERS ---');
    const users = await db.collection('users').limit(5).get();
    users.forEach(doc => {
        console.log(doc.id, '=>', {
            user_id: doc.data().user_id,
            fullName: doc.data().full_name,
            role: doc.data().role,
            default_organizer_id: doc.data().default_organizer_id
        });
    });
}
run().catch(console.error);
//# sourceMappingURL=inspect.js.map