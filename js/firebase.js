import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const firebaseConfig = {

    apiKey: "AIzaSyAfi1pRrAWX4LawVfUwCat4c-MFNmue-Rc",

    authDomain: "nesi-medicals.firebaseapp.com",

    projectId: "nesi-medicals",

    storageBucket: "nesi-medicals.firebasestorage.app",

    messagingSenderId: "242774167260",

    appId: "1:242774167260:web:76c3f133c970bc7a47ae19"

};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


export {
    app,
    auth,
    db
};
