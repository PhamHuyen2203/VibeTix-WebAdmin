import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { environment } from '../../../environments/environment';

export const firebaseApp = initializeApp(environment.firebase);
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseDb = getFirestore(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);