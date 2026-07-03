import * as admin from 'firebase-admin';

admin.initializeApp({
  projectId: 'mobile-61a6c',
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

async function run() {
  // 1. Inspect Orders structure
  console.log('=== ORDERS (first 3) ===');
  const orders = await db.collection('orders').limit(3).get();
  orders.forEach(doc => {
    const data = doc.data();
    console.log(`\nOrder doc.id=${doc.id}`);
    console.log('  Top-level keys:', Object.keys(data));
    console.log('  status:', data.status);
    console.log('  total_amount:', data.total_amount, '| amount:', data.amount);
    console.log('  event_id (top):', data.event_id);
    console.log('  user_id:', data.user_id);
    
    // Check order_items / items
    const items = data.order_items || data.items || [];
    console.log('  order_items count:', items.length);
    if (items.length > 0) {
      console.log('  order_items[0] keys:', Object.keys(items[0]));
      console.log('  order_items[0]:', JSON.stringify(items[0], null, 2));
    }
    if (items.length > 1) {
      console.log('  order_items[1]:', JSON.stringify(items[1], null, 2));
    }
  });

  // 2. Inspect Events structure  
  console.log('\n=== EVENTS (first 3) ===');
  const events = await db.collection('events').limit(3).get();
  events.forEach(doc => {
    const data = doc.data();
    console.log(`\nEvent doc.id=${doc.id}`);
    console.log('  event_id:', data.event_id);
    console.log('  organizer_id:', data.organizer_id);
    console.log('  title:', data.title);
    console.log('  status_str:', data.status_str, '| status:', data.status);
    console.log('  tickets_sold:', data.tickets_sold);
    console.log('  total_tickets:', data.total_tickets);
  });

  // 3. Inspect Organizers structure
  console.log('\n=== ORGANIZERS (first 3) ===');
  const orgs = await db.collection('organizers').limit(3).get();
  orgs.forEach(doc => {
    const data = doc.data();
    console.log(`\nOrganizer doc.id=${doc.id}`);
    console.log('  organizer_id:', data.organizer_id);
    console.log('  brand_name:', data.brand_name);
    console.log('  is_verified:', data.is_verified);
    console.log('  user_id:', data.user_id);
  });

  // 4. Check if order_items is a subcollection instead
  console.log('\n=== CHECK SUBCOLLECTION order_items ===');
  const firstOrder = orders.docs[0];
  if (firstOrder) {
    const subItems = await db.collection('orders').doc(firstOrder.id).collection('order_items').limit(5).get();
    console.log('Subcollection order_items count:', subItems.size);
    subItems.forEach(doc => {
      console.log(`  item doc.id=${doc.id}`, JSON.stringify(doc.data(), null, 2));
    });
  }
}

run().catch(console.error);
