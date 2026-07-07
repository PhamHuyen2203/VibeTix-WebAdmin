import * as admin from 'firebase-admin';
import * as path from 'path';

const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  const snapshot = await db.collection('notifications').orderBy('created_at', 'desc').limit(20).get();
  console.log('Total:', snapshot.size);
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}

run().catch(console.error);
