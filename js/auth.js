// =========================================
// NESI MEDICALS - AUTHENTICATION
// =========================================

import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { auth } from "./firebase.js";


// =========================================
// LOGIN
// =========================================

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const loginButton = document.getElementById("loginButton");
        const message = document.getElementById("loginMessage");

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Clear previous message
        if (message) {
            message.style.display = "none";
            message.className = "message";
            message.textContent = "";
        }

        // Basic validation
        if (!email || !password) {
            showMessage(
                "Please enter your email address and password.",
                "error"
            );
            return;
        }

        // Loading state
        if (loginButton) {
            loginButton.disabled = true;
            loginButton.textContent = "Signing in...";
        }

        try {

            // Firebase login
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            // Successful login
            if (loginButton) {
                loginButton.textContent = "Login successful...";
            }

            // Send user to dashboard
            window.location.href = "dashboard.html";

        } catch (error) {

            console.error("Login error:", error);

            let errorMessage =
                "Unable to sign in. Please check your details.";

            switch (error.code) {

                case "auth/invalid-credential":
                    errorMessage =
                        "Incorrect email or password.";
                    break;

                case "auth/user-not-found":
                    errorMessage =
                        "No account was found with this email.";
                    break;

                case "auth/wrong-password":
                    errorMessage =
                        "Incorrect password.";
                    break;

                case "auth/invalid-email":
                    errorMessage =
                        "Please enter a valid email address.";
                    break;

                case "auth/too-many-requests":
                    errorMessage =
                        "Too many attempts. Please try again later.";
                    break;

                case "auth/network-request-failed":
                    errorMessage =
                        "Network error. Please check your internet connection.";
                    break;

                default:
                    errorMessage =
                        "Login failed. Please try again.";
            }

            showMessage(errorMessage, "error");

            if (loginButton) {
                loginButton.disabled = false;
                loginButton.textContent =
                    "Login to Dashboard";
            }
        }
    });
}


// =========================================
// PASSWORD RESET
// =========================================

const forgotPassword =
    document.getElementById("forgotPassword");

if (forgotPassword) {

    forgotPassword.addEventListener(
        "click",
        async function (event) {

            event.preventDefault();

            const emailInput =
                document.getElementById("email");

            const email =
                emailInput.value.trim();

            if (!email) {

                showMessage(
                    "Enter your email address first, then tap Forgot password.",
                    "error"
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
                    "Password reset instructions have been sent to your email.",
                    "success"
                );

            } catch (error) {

                console.error(
                    "Password reset error:",
                    error
                );

                showMessage(
                    "We could not send the password reset email. Please check the email address.",
                    "error"
                );
            }
        }
    );
}


// =========================================
// AUTHENTICATION STATE
// =========================================

onAuthStateChanged(auth, function (user) {

    if (user) {

        console.log(
            "Logged in user:",
            user.email
        );

    } else {

        console.log(
            "No user currently signed in."
        );

    }
});


// =========================================
// LOGOUT FUNCTION
// =========================================

export async function logoutUser() {

    try {

        await signOut(auth);

        window.location.href = "index.html";

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

    }
}


// =========================================
// MESSAGE FUNCTION
// =========================================

function showMessage(text, type) {

    const message =
        document.getElementById("loginMessage");

    if (!message) return;

    message.textContent = text;

    message.className =
        "message " + type;

    message.style.display = "block";
}
