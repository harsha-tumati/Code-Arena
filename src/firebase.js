import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// const auth = getAuth();



const firebaseConfig = {
  apiKey: "AIzaSyA6ZRc4yLQDPCW4y1XXak5OzYaMRxeixGo",
  authDomain: "code-arena-44042.firebaseapp.com",
  projectId: "code-arena-44042",
  storageBucket: "code-arena-44042.firebasestorage.app",
  messagingSenderId: "869458833080",
  appId: "1:869458833080:web:817185f3b5bc030e2e8e4d",
  measurementId: "G-70JLB64LV1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Initialize Auth with persistence
const auth = getAuth(app);
//console.log("Current user:", auth.currentUser);
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Auth persistence error:", error);
  });

// Initialize Firestore
const db = getFirestore(app);

// Enable offline persistence
enableMultiTabIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support persistence.');
    }
  });

// Initialize other services
export const provider = new GoogleAuthProvider();
export const storage = getStorage(app);
const functions = getFunctions(app);

// Connect to emulators in development
if (window.location.hostname === 'localhost') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
  connectStorageEmulator(storage, 'localhost', 9199);
}

// Export initialized services
export { auth, db, functions };
