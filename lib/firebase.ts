import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDXQZKYN0Mi-y7UrUmP4ArMFvq-vTFocZw",
  authDomain: "quantum-oracle-test.firebaseapp.com",
  databaseURL: "https://quantum-oracle-test-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "quantum-oracle-test",
  storageBucket: "quantum-oracle-test.firebasestorage.app",
  messagingSenderId: "49899741876",
  appId: "1:49899741876:web:26d353c3c562c3c762ede1"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);