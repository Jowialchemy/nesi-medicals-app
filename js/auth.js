import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { auth } from "./firebase.js";


const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const rememberMe = document.getElementById("rememberMe");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const forgotPassword = document.getElementById("forgotPassword");


/* ==============================
   MESSAGE
============================== */

function showMessage(message, type = "error") {

    if (!loginMessage) return;

    loginMessage.textContent = message;

    loginMessage.className = "message " + type;

}


/* ==============================
   LOGIN
============================== */

if (loginForm) {

    loginForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {

            showMessage(
                "Please enter your email and password."
            );

            return;
        }


        loginButton.disabled = true;

        loginButton.innerHTML =
            '<span class="spinner"></span>Signing in...';


        try {

            /*
             * Remember me:
             * checked = stay signed in
             * unchecked = session only
             */

            const persistence = rememberMe && rememberMe.checked
                ? browserLocalPersistence
                : browserSessionPersistence;


            await setPersistence(auth, persistence);


            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


            showMessage(
                "Login successful! Opening dashboard...",
                "success"
            );


            setTimeout(function () {

                window.location.href = "dashboard.html";

            }, 700);


        } catch (error) {

            console.error("Login error:", error);


            let message =
                "Unable to sign in. Please check your email and password.";


            switch (error.code) {

                case "auth/invalid-credential":

                    message =
                        "Incorrect email or password.";

                    break;


                case "auth/invalid-email":

                    message =
                        "Please enter a valid email address.";

                    break;


                case "auth/user-disabled":

                    message =
                        "This account has been disabled.";

                    break;


                case "auth/too-many-requests":

                    message =
                        "Too many failed attempts. Please try again later.";

                    break;


                case "auth/network-request-failed":

                    message =
                        "Network error. Please check your internet connection.";

                    break;

            }


            showMessage(message);


            loginButton.disabled = false;

            loginButton.innerHTML =
                "Login to Dashboard";

        }

    });

}


/* ==============================
   FORGOT PASSWORD
============================== */

if (forgotPassword) {

    forgotPassword.addEventListener("click", async function (event) {

        event.preventDefault();


        const email = emailInput.value.trim();


        if (!email) {

            showMessage(
                "Enter your email address first, then click Forgot password."
            );

            emailInput.focus();

            return;

        }


        try {

            await sendPasswordResetEmail(
                auth,
                email
            );


            showMessage(
                "Password reset email sent. Check your inbox.",
                "success"
            );


        } catch (error) {

            console.error(
                "Password reset error:",
                error
            );


            let message =
                "Unable to send password reset email.";


            if (error.code === "auth/user-not-found") {

                message =
                    "No account was found with this email address.";

            }

            if (error.code === "auth/invalid-email") {

                message =
                    "Please enter a valid email address.";

            }


            showMessage(message);

        }

    });

}
