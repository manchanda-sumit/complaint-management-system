import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyBMIbI1TewCMWqN4Xn_Bw34wObA26JJ3i0",
  authDomain: "complaint-management-sys-e7464.firebaseapp.com",
  projectId: "complaint-management-sys-e7464",
  storageBucket: "complaint-management-sys-e7464.firebasestorage.app",
  messagingSenderId: "1027410151999",
  appId: "1:1027410151999:web:ef6e2b23706e4a5d79c68a"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


export { auth, db };