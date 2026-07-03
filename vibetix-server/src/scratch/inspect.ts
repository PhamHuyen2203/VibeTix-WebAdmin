import * as admin from 'firebase-admin';

// Initialize firebase admin, target local emulator if running
// process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
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
