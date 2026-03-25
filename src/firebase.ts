
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCOh6uVRW1cd2O_AGQ4Dur9s8cHlLIkcME",
  authDomain: "axion-7357e.firebaseapp.com",
  projectId: "axion-7357e",
  storageBucket: "axion-7357e.firebasestorage.app",
  messagingSenderId: "535146454370",
  // appId is optional for core auth/firestore if web app is not strictly registered, 
  // but if you have it, you can add it here.
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Persistent storage is optional and removed for compatibility.

export const auth = getAuth(app);
