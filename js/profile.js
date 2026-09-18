import {
    auth,
    db
} from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const profileName = document.getElementById("profileName");
const profileRole = document.getElementById("profileRole");
const fullName = document.getElementById("fullName");
const email = document.getElementById("email");
const phone = document.getElementById("phone");
const role = document.getElementById("role");
const avatar = document.getElementById("avatar");
const statusMessage = document.getElementById("statusMessage");
const logoutBtn = document.getElementById("logoutBtn");

function showStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "status";

    if (type) {
        statusMessage.classList.add(type);
    }
}

function getInitials(name) {
    if (!name) {
        return "--";
    }

    const parts = name
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }

    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();
}

function cleanValue(value) {
    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    ) {
        return "Not set";
    }

    return String(value);
}

async function findUserStaffRecord(user) {
    try {
        const staffSnapshot = await getDocs(
            collection(db, "staff")
        );

        let foundRecord = null;

        staffSnapshot.forEach((doc) => {
            const data = doc.data();

            const recordEmail = String(
                data.email || ""
            ).trim().toLowerCase();

            const userEmail = String(
                user.email || ""
            ).trim().toLowerCase();

            const recordUid = data.uid || data.userId || "";

            if (
                recordUid === user.uid ||
                (
                    userEmail &&
                    recordEmail &&
                    userEmail === recordEmail
                )
            ) {
                foundRecord = data;
            }
        });

        return foundRecord;

    } catch (error) {
        console.warn(
            "Could not read staff collection:",
            error
        );

        return null;
    }
}

async function loadProfile(user) {

    if (!user) {
        return;
    }

    showStatus("Loading your profile...");

    try {

        /*
         * Firebase Authentication information
         */
        const authName = user.displayName || "";
        const authEmail = user.email || "";

        /*
         * Try to find additional staff information
         * from Firestore.
         */
        const staffRecord =
            await findUserStaffRecord(user);

        /*
         * Support several common field names so the
         * profile keeps working with existing records.
         */
        const name =
            staffRecord?.fullName ||
            staffRecord?.name ||
            authName ||
            "User";

        const userEmail =
            staffRecord?.email ||
            authEmail ||
            "Not set";

        const userPhone =
            staffRecord?.phone ||
            staffRecord?.phoneNumber ||
            staffRecord?.mobile ||
            "Not set";

        const userRole =
            staffRecord?.role ||
            staffRecord?.position ||
            staffRecord?.staffRole ||
            "Staff";

        /*
         * Display profile
         */
        profileName.textContent = name;

        profileRole.textContent =
            cleanValue(userRole);

        fullName.textContent =
            cleanValue(name);

        email.textContent =
            cleanValue(userEmail);

        phone.textContent =
            cleanValue(userPhone);

        role.textContent =
            cleanValue(userRole);

        avatar.textContent =
            getInitials(name);

        showStatus(
            "Profile loaded successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );

        showStatus(
            "Your account was found, but some profile information could not be loaded.",
            "error"
        );

        /*
         * At minimum, always show Firebase Auth details.
         */
        const fallbackName =
            user.displayName || "User";

        profileName.textContent =
            fallbackName;

        profileRole.textContent =
            "Staff";

        fullName.textContent =
            fallbackName;

        email.textContent =
            user.email || "Not set";

        phone.textContent =
            "Not set";

        role.textContent =
            "Staff";

        avatar.textContent =
            getInitials(fallbackName);
    }
}

/*
 * Wait for Firebase authentication.
 */
onAuthStateChanged(auth, async (user) => {

    if (!user) {

        showStatus(
            "You are not logged in. Redirecting..."
        );

        window.location.href = "login.html";

        return;
    }

    await loadProfile(user);
});

/*
 * Logout
 */
logoutBtn.addEventListener("click", async () => {

    try {

        logoutBtn.disabled = true;
        logoutBtn.textContent = "Logging out...";

        await signOut(auth);

        window.location.href = "login.html";

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        logoutBtn.disabled = false;
        logoutBtn.textContent = "Logout";

        showStatus(
            "Unable to log out. Please try again.",
            "error"
        );
    }
});
