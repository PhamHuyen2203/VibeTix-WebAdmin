// Paste this into the browser console to inspect Firestore data
// Or import it as a temporary debug component

import { collection, getDocs } from 'firebase/firestore';
import { firebaseDb } from '../../core/firebase/firebase.client';
import { COLLECTIONS } from '../../core/firebase/collections';

export async function debugFirestoreData() {
  console.log('=== DEBUG: Inspecting Firestore data ===');
  
  // Orders
  const ordersSnap = await getDocs(collection(firebaseDb, COLLECTIONS.orders));
  console.log(`Total orders: ${ordersSnap.size}`);
  ordersSnap.docs.slice(0, 3).forEach(d => {
    const data = d.data();
    console.log(`Order [${d.id}]:`, {
      keys: Object.keys(data),
      status: data['status'],
      event_id: data['event_id'],
      eventId: data['eventId'],
      total_amount: data['total_amount'],
      amount: data['amount'],
      items: data['items'],
      order_items: data['order_items'],
    });
  });

  // Events
  const eventsSnap = await getDocs(collection(firebaseDb, COLLECTIONS.events));
  console.log(`\nTotal events: ${eventsSnap.size}`);
  eventsSnap.docs.slice(0, 3).forEach(d => {
    const data = d.data();
    console.log(`Event [${d.id}]:`, {
      keys: Object.keys(data),
      event_id: data['event_id'],
      organizer_id: data['organizer_id'],
      title: data['title'],
      status: data['status'],
      status_str: data['status_str'],
    });
  });

  // Organizers
  const orgsSnap = await getDocs(collection(firebaseDb, COLLECTIONS.organizers));
  console.log(`\nTotal organizers: ${orgsSnap.size}`);
  orgsSnap.docs.slice(0, 3).forEach(d => {
    const data = d.data();
    console.log(`Organizer [${d.id}]:`, {
      keys: Object.keys(data),
      organizer_id: data['organizer_id'],
      brand_name: data['brand_name'],
      is_verified: data['is_verified'],
    });
  });

  // Check order_items subcollection
  const firstOrder = ordersSnap.docs[0];
  if (firstOrder) {
    try {
      const subItems = await getDocs(collection(firebaseDb, `${COLLECTIONS.orders}/${firstOrder.id}/order_items`));
      console.log(`\nSubcollection order_items for order ${firstOrder.id}: ${subItems.size} docs`);
      subItems.docs.forEach(d => {
        console.log(`  Item [${d.id}]:`, d.data());
      });
    } catch(e) {
      console.log('No order_items subcollection found');
    }
  }
}
