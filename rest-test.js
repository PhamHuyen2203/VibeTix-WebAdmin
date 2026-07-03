const https = require('https');

https.get('https://firestore.googleapis.com/v1/projects/mobile-5f256/databases/(default)/documents/order_items?pageSize=3', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log("order_items ROOT COLLECTION:", JSON.stringify(json, null, 2));
    } catch(e) {}
  });
}).on('error', () => {});

https.get('https://firestore.googleapis.com/v1/projects/mobile-5f256/databases/(default)/documents/order_item?pageSize=3', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log("order_item ROOT COLLECTION:", JSON.stringify(json, null, 2));
    } catch(e) {}
  });
}).on('error', () => {});
