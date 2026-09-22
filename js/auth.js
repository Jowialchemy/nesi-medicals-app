import { signInWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./firebase.js";
const loginForm = document.getElementById("loginForm"); const emailInput = document.getElementById("email"); const passwordInput = document.getElementById("password"); const rememberMe = document.getElementById("rememberMe"); const loginButton = document.getElementById("loginButton"); const loginMessage = document.getElementById("loginMessage"); const forgotPassword = document.getElementById("forgotPassword");
function showMessage(message, type = "error") {
if (!loginMessage) return;

loginMessage.textContent = message;

loginMessage.className =
    "message " + type;
}
/* ============================== GET STAFF PROFILE ============================== */
async function getStaffProfile(user) {
try {

    const q = query(
        collection(db, "staff"),
        where("email", "==", user.email.toLowerCase())
    );

    const snapshot =
        await getDocs(q);

    if (snapshot.empty) {
        return null;
    }

    const staffDoc =
        snapshot.docs[0];

    return {
        id: staffDoc.id,
        ...staffDoc.data()
    };

} catch(error) {

    console.error(
        "Staff profile lookup error:",
        error
    );

    return null;
}
}
/* ============================== LOGIN ============================== */
if (loginForm) {
loginForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const email =
            emailInput.value.trim().toLowerCase();

        const password =
            passwordInput.value;


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

            const persistence =
                rememberMe && rememberMe.checked
                ? browserLocalPersistence
                : browserSessionPersistence;


            await setPersistence(
                auth,
                persistence
            );


            const credential =
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


            /*
             * Automatically connect an existing
             * Staff record to its Firebase UID.
             *
             * This is important for staff records
             * such as Esther that were created before
             * the new account system.
             */

            const staff =
                await getStaffProfile(
                    credential.user
                );


            if (staff) {

                /*
                 * If the staff record already has
                 * another UID, do not overwrite it.
                 */

                if (!staff.uid) {

                    try {

                        const {
                            updateDoc,
                            doc
                        } = await import(
                            "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
                        );

                        await updateDoc(
                            doc(db, "staff", staff.id),
                            {
                                uid: credential.user.uid,
                                linkedAt:
                                    new Date(),
                                linkedEmail:
                                    credential.user.email
                            }
                        );

                    } catch(error) {

                        console.error(
                            "Unable to link staff UID:",
                            error
                        );
                    }
                }

                /*
                 * Save staff information locally
                 * for pages that need it immediately.
                 */

                localStorage.setItem(
                    "nesiStaff",
                    JSON.stringify({
                        id: staff.id,
                        uid: credential.user.uid,
                        staffId: staff.staffId || "",
                        name: staff.name || "",
                        role: staff.role || "",
                        email: staff.email || "",
                        phone: staff.phone || "",
                        status: staff.status || "Active",
                        permissions:
                            staff.permissions || []
                    })
                );

            } else {

                /*
                 * Administrator / owner account that
                 * does not yet have a staff document.
                 */

                localStorage.setItem(
                    "nesiStaff",
                    JSON.stringify({
                        uid: credential.user.uid,
                        name:
                            credential.user.displayName || "",
                        email:
                            credential.user.email || "",
                        role: "Administrator",
                        status: "Active",
                        permissions: [
                            "dashboard",
                            "sales",
                            "sales-history",
                            "inventory",
                            "products",
                            "customers",
                            "suppliers",
                            "expenses",
                            "reports",
                            "staff",
                            "settings",
                            "profile"
                        ]
                    })
                );
            }


            showMessage(
                "Login successful! Opening dashboard...",
                "success"
            );


            setTimeout(() => {

                window.location.href =
                    "dashboard.html";

            }, 500);


        } catch(error) {

            console.error(
                "Login error:",
                error
            );


            let message =
                "Unable to sign in. Please check your email and password.";


            switch(error.code) {

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
    }
);
}
/* ============================== FORGOT PASSWORD ============================== */
if (forgotPassword) {
forgotPassword.addEventListener(
    "click",
    async function(event) {

        event.preventDefault();

        const email =
            emailInput.value.trim();


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


        } catch(error) {

            console.error(
                "Password reset error:",
                error
            );


            let message =
                "Unable to send password reset email.";


            if (
                error.code ===
                "auth/user-not-found"
            ) {

                message =
                    "No account was found with this email address.";
            }


            if (
                error.code ===
                "auth/invalid-email"
            ) {

                message =
                    "Please enter a valid email address.";
            }


            showMessage(message);
        }
    }
);
}
