import { auth, db } from "./firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
/*
NESI MEDICALS COMMON STAFF PERMISSION SYSTEM
*/
/* ============================== PAGE PERMISSION MAP ============================== */
const PAGE_PERMISSIONS = {
"dashboard.html": "dashboard",
"sales.html": "sales",
"sales-history.html": "sales-history",
"inventory.html": "inventory",
"products.html": "products",
"customers.html": "customers",
"suppliers.html": "suppliers",
"expenses.html": "expenses",
"reports.html": "reports",
"staff.html": "staff",
"settings.html": "settings",
"profile.html": "profile"
};
/* ============================== ADMIN PERMISSIONS ============================== */
const ADMIN_PERMISSIONS = [ "dashboard", "sales", "sales-history", "inventory", "products", "customers", "suppliers", "expenses", "reports", "staff", "settings", "profile" ];
/* ============================== GET CURRENT PAGE ============================== */
function getCurrentPage() {
let page =
    window.location.pathname
    .split("/")
    .pop()
    .toLowerCase();

if (!page) {
    page = "dashboard.html";
}

return page;
}
/* ============================== GET STAFF PROFILE ============================== */
async function getStaffProfile(user) {
if (!user) {
    return null;
}

try {

    /* First search by Firebase UID */

    const uidQuery =
        query(
            collection(db, "staff"),
            where("uid", "==", user.uid)
        );

    const uidSnapshot =
        await getDocs(uidQuery);

    if (!uidSnapshot.empty) {

        const staffDoc =
            uidSnapshot.docs[0];

        return {
            id: staffDoc.id,
            ...staffDoc.data()
        };
    }


    /* Fallback: search by email */

    if (user.email) {

        const emailQuery =
            query(
                collection(db, "staff"),
                where(
                    "email",
                    "==",
                    user.email.toLowerCase()
                )
            );

        const emailSnapshot =
            await getDocs(emailQuery);

        if (!emailSnapshot.empty) {

            const staffDoc =
                emailSnapshot.docs[0];

            return {
                id: staffDoc.id,
                ...staffDoc.data()
            };
        }
    }

} catch (error) {

    console.error(
        "Permission profile error:",
        error
    );
}

return null;
}
/* ============================== SAVE STAFF LOCALLY ============================== */
function saveLocalStaff(staff, user) {
if (!staff) {
    return;
}

localStorage.setItem(
    "nesiStaff",
    JSON.stringify({

        id: staff.id || "",

        uid:
            staff.uid ||
            user.uid,

        staffId:
            staff.staffId || "",

        name:
            staff.name ||
            user.displayName ||
            "",

        role:
            staff.role ||
            "",

        email:
            staff.email ||
            user.email ||
            "",

        phone:
            staff.phone ||
            "",

        status:
            staff.status ||
            "Active",

        permissions:
            staff.permissions ||
            []

    })
);
}
/* ============================== CHECK PERMISSION ============================== */
function hasPermission(permission, staff) {
if (!staff) {
    return false;
}


/* Administrator gets everything */

if (
    staff.role === "Administrator" ||
    staff.role === "Admin"
) {
    return true;
}


const permissions =
    Array.isArray(staff.permissions)
        ? staff.permissions
        : [];


return permissions.includes(permission);
}
/* ============================== HIDE SIDEBAR ITEMS ============================== */
function applySidebarPermissions(staff) {
const links =
    document.querySelectorAll(
        ".sidebar a, nav a"
    );


links.forEach(link => {

    const href =
        link.getAttribute("href");

    if (!href) {
        return;
    }


    const page =
        href.split("/").pop().toLowerCase();


    const permission =
        PAGE_PERMISSIONS[page];


    if (!permission) {
        return;
    }


    if (
        !hasPermission(
            permission,
            staff
        )
    ) {

        link.style.display = "none";

    } else {

        link.style.display = "";
    }

});
}
/* ============================== PROTECT CURRENT PAGE ============================== */
async function protectCurrentPage(staff) {
const page =
    getCurrentPage();

const requiredPermission =
    PAGE_PERMISSIONS[page];


/* Pages not listed do not need
   permission checking here. */

if (!requiredPermission) {
    return true;
}


if (
    hasPermission(
        requiredPermission,
        staff
    )
) {

    return true;
}


/*
 * Staff does not have permission.
 *
 * Send them to Sales because
 * ordinary staff normally work
 * from the Sales page.
 */

if (
    hasPermission(
        "sales",
        staff
    )
) {

    window.location.href =
        "sales.html";

} else if (
    hasPermission(
        "inventory",
        staff
    )
) {

    window.location.href =
        "inventory.html";

} else if (
    hasPermission(
        "profile",
        staff
    )
) {

    window.location.href =
        "profile.html";

} else {

    await signOut(auth);

    window.location.href =
        "login.html";
}

return false;
}
/* ============================== START PERMISSION SYSTEM ============================== */
onAuthStateChanged( auth, async user => {
if (!user) {

        window.location.href =
            "login.html";

        return;
    }


    const staff =
        await getStaffProfile(user);


    /*
     * No staff record means this is
     * treated as the main administrator.
     *
     * This prevents the owner account
     * from being locked out.
     */

    const effectiveStaff =
        staff || {

            uid: user.uid,

            name:
                user.displayName || "",

            email:
                user.email || "",

            role:
                "Administrator",

            status:
                "Active",

            permissions:
                ADMIN_PERMISSIONS

        };


    /*
     * Inactive staff cannot use
     * the application.
     */

    if (
        effectiveStaff.status &&
        effectiveStaff.status !== "Active"
    ) {

        alert(
            "Your staff account is inactive. Please contact the administrator."
        );

        await signOut(auth);

        window.location.href =
            "login.html";

        return;
    }


    saveLocalStaff(
        effectiveStaff,
        user
    );


    /*
     * Check whether the current page
     * is allowed.
     */

    const allowed =
        await protectCurrentPage(
            effectiveStaff
        );


    if (!allowed) {
        return;
    }


    /*
     * Hide pages from sidebar
     * according to permissions.
     */

    applySidebarPermissions(
        effectiveStaff
    );


    /*
     * Make staff information available
     * globally to other scripts.
     */

    window.nesiStaff =
        effectiveStaff;

    window.nesiHasPermission =
        function(permission) {

            return hasPermission(
                permission,
                effectiveStaff
            );
        };

}
);
/* ============================== GLOBAL HELPER ============================== */
window.NesiPermissions = {
pagePermissions:
    PAGE_PERMISSIONS,

adminPermissions:
    ADMIN_PERMISSIONS,

hasPermission:
    hasPermission
};
