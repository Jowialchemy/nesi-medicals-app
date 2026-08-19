/* =========================================
   NESI MEDICALS & MINIMART ENTERPRISES
   DASHBOARD JAVASCRIPT
   ========================================= */

document.addEventListener("DOMContentLoaded", function () {

    console.log("Nesi Medicals Dashboard Loaded");


    /* =====================================
       CURRENT DATE & TIME
    ====================================== */

    updateDateTime();

    setInterval(updateDateTime, 60000);


    /* =====================================
       MOBILE NAVIGATION
    ====================================== */

    setupMobileNavigation();


    /* =====================================
       DASHBOARD QUICK ACTIONS
    ====================================== */

    setupQuickActions();


    /* =====================================
       LOGOUT
    ====================================== */

    setupLogout();

});


/* =========================================
   DATE & TIME
   ========================================= */

function updateDateTime() {

    const dateElement =
        document.getElementById("current-date");

    const timeElement =
        document.getElementById("current-time");


    const now = new Date();


    if (dateElement) {

        dateElement.textContent =
            now.toLocaleDateString("en-NG", {

                weekday: "long",

                year: "numeric",

                month: "long",

                day: "numeric"

            });

    }


    if (timeElement) {

        timeElement.textContent =
            now.toLocaleTimeString("en-NG", {

                hour: "2-digit",

                minute: "2-digit"

            });

    }

}


/* =========================================
   MOBILE NAVIGATION
   ========================================= */

function setupMobileNavigation() {

    const mobileLinks =
        document.querySelectorAll(".mobile-nav a");


    mobileLinks.forEach(function (link) {

        link.addEventListener("click", function () {

            mobileLinks.forEach(function (item) {

                item.classList.remove("active");

            });


            this.classList.add("active");

        });

    });

}


/* =========================================
   QUICK ACTIONS
   ========================================= */

function setupQuickActions() {

    const quickActions =
        document.querySelectorAll(".quick-actions a");


    quickActions.forEach(function (action) {

        action.addEventListener("click", function () {

            console.log(
                "Opening:",
                this.innerText.trim()
            );

        });

    });

}


/* =========================================
   LOGOUT
   ========================================= */

function setupLogout() {

    const logoutButton =
        document.querySelector(".logout");


    if (!logoutButton) {
        return;
    }


    logoutButton.addEventListener("click", function (event) {

        const confirmed =
            confirm(
                "Are you sure you want to logout?"
            );


        if (!confirmed) {

            event.preventDefault();

            return;

        }


        console.log("User logged out");

    });

}


/* =========================================
   DASHBOARD NOTIFICATION
   ========================================= */

function showDashboardMessage(message) {

    alert(message);

}


/* =========================================
   FORMAT NIGERIAN CURRENCY
   ========================================= */

function formatCurrency(amount) {

    return new Intl.NumberFormat("en-NG", {

        style: "currency",

        currency: "NGN",

        minimumFractionDigits: 2

    }).format(amount);

}


/* =========================================
   EXAMPLE
   ========================================= */

// console.log(formatCurrency(185500));
