// =========================================
// NESI MEDICALS - FIREBASE CONFIGURATION
// =========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


// Firebase configuration

const firebaseConfig = {

    apiKey: "AIzaSyAfi1pRrAWX4LawVfUwCat4c-MFNmue-Rc",

    authDomain: "nesi-medicals.firebaseapp.com",

    projectId: "nesi-medicals",

    storageBucket: "nesi-medicals.firebasestorage.app",

    messagingSenderId: "242774167260",

    appId: "1:242774167260:web:76c3f133c970bc7a47ae19"

};


// Initialize Firebase

const app = initializeApp(firebaseConfig);


// Initialize Authentication

const auth = getAuth(app);


// Export Firebase

export {
    app,
    auth
};
