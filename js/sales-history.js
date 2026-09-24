import { auth, db } from "./firebase.js";

import {
    collection,
    onSnapshot,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


/* =========================================================
   ELEMENTS
========================================================= */

const salesTable = document.getElementById("salesTable");
const searchInput = document.getElementById("searchInput");

const receiptModal = document.getElementById("receiptModal");
const printArea = document.getElementById("printArea");

const closeModal = document.getElementById("closeModal");
const closeModal2 = document.getElementById("closeModal2");
const printReceipt = document.getElementById("printReceipt");

const mobileMenu = document.getElementById("mobileMenu");
const sidebar = document.getElementById("sidebar");

const logoutBtn = document.getElementById("logoutBtn");
const userEmail = document.getElementById("userEmail");


/* =========================================================
   STATE
========================================================= */

let sales = [];
let selectedSale = null;
let unsubscribeSales = null;


/* =========================================================
   HELPERS
========================================================= */

function money(value) {
    return "₦" + (Number(value) || 0).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function getDate(value) {

    if (!value) {
        return null;
    }

    if (typeof value.toDate === "function") {
        return value.toDate();
    }

    if (value.seconds) {
        return new Date(value.seconds * 1000);
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return null;
    }

    return date;
}


function formatDate(value) {

    const date = getDate(value);

    if (!date) {
        return "—";
    }

    return date.toLocaleString("en-NG", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}


/* =========================================================
   STAFF ID
========================================================= */

function getCurrentStaffId() {

    try {

        const savedStaff = localStorage.getItem("nesiStaff");

        if (savedStaff) {

            const staff = JSON.parse(savedStaff);

            if (
                staff &&
                staff.staffId &&
                String(staff.staffId).trim()
            ) {
                return String(staff.staffId).trim();
            }
        }

    } catch (error) {

        console.error(
            "Unable to read staff ID:",
            error
        );
    }


    if (
        window.nesiStaff &&
        window.nesiStaff.staffId
    ) {

        return String(
            window.nesiStaff.staffId
        ).trim();
    }


    return "ADMIN";
}


/* =========================================================
   SEARCH
========================================================= */

function matchesSearch(sale) {

    const search = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    if (!search) {
        return true;
    }


    const saleNumber =
        String(sale.saleNumber || "").toLowerCase();

    const customer =
        String(sale.customer || "").toLowerCase();

    const staffId =
        String(sale.staffId || "").toLowerCase();


    return (
        saleNumber.includes(search) ||
        customer.includes(search) ||
        staffId.includes(search)
    );
}


/* =========================================================
   RENDER SALES
========================================================= */

function renderSales() {

    if (!salesTable) {
        console.error(
            "salesTable element was not found."
        );
        return;
    }


    const filteredSales =
        sales.filter(matchesSearch);


    if (!filteredSales.length) {

        salesTable.innerHTML = `
            <tr>
                <td colspan="7" class="empty">
                    No sales found.
                </td>
            </tr>
        `;

        return;
    }


    salesTable.innerHTML =
        filteredSales.map(sale => {

            const items =
                Array.isArray(sale.items)
                    ? sale.items
                    : [];

            const totalQuantity =
                Number(
                    sale.totalQuantity ||
                    items.reduce(
                        (total, item) =>
                            total +
                            Number(item.quantity || 0),
                        0
                    )
                );


            return `
                <tr>

                    <td>
                        <span class="sale-number">
                            ${escapeHtml(
                                sale.saleNumber || "—"
                            )}
                        </span>
                    </td>

                    <td>
                        ${escapeHtml(
                            formatDate(sale.createdAt)
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            sale.customer ||
                            "Walk-in Customer"
                        )}
                    </td>

                    <td>
                        ${totalQuantity}
                    </td>

                    <td>
                        <span class="amount">
                            ${money(sale.total)}
                        </span>
                    </td>

                    <td>
                        <span class="payment">
                            ${escapeHtml(
                                sale.paymentMethod || "—"
                            )}
                        </span>
                    </td>

                    <td>

                        <button
                            type="button"
                            class="btn btn-view"
                            data-view="${escapeHtml(sale.id)}"
                        >
                            View
                        </button>

                        <button
                            type="button"
                            class="btn btn-print"
                            data-print="${escapeHtml(sale.id)}"
                        >
                            Reprint
                        </button>

                    </td>

                </tr>
            `;

        }).join("");


    /* VIEW BUTTONS */

    salesTable
        .querySelectorAll("[data-view]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const sale =
                        sales.find(
                            item =>
                                item.id ===
                                button.dataset.view
                        );

                    openReceipt(sale);
                }
            );

        });


    /* PRINT BUTTONS */

    salesTable
        .querySelectorAll("[data-print]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const sale =
                        sales.find(
                            item =>
                                item.id ===
                                button.dataset.print
                        );

                    printSale(sale);
                }
            );

        });
}


/* =========================================================
   RECEIPT
========================================================= */

function renderReceipt(sale) {

    if (!printArea || !sale) {
        return;
    }


    const items =
        Array.isArray(sale.items)
            ? sale.items
            : [];


    const staffId =
        sale.staffId ||
        "ADMIN";


    const amountPaid =
        Number(sale.amountPaid || 0);


    const outstanding =
        Number(
            sale.outstandingAmount ??
            sale.outstandingBalance ??
            0
        );


    const paymentStatus =
        sale.paymentStatus ||
        (
            outstanding > 0
                ? "Credit"
                : "Paid"
        );


    printArea.innerHTML = `

        <div class="receipt-header">

            <img
                src="assets/logo.png"
                alt="Nesi Medicals Logo"
            >

            <h2>
                Nesi Medicals
            </h2>

            <p>
                & Minimart Enterprises
            </p>

            <p>
                SALES RECEIPT
            </p>

        </div>


        <div class="receipt-info">

            <div>
                <strong>Receipt:</strong>
                ${escapeHtml(
                    sale.saleNumber || "—"
                )}
            </div>

            <div>
                <strong>Date:</strong>
                ${escapeHtml(
                    formatDate(sale.createdAt)
                )}
            </div>

            <div>
                <strong>Customer:</strong>
                ${escapeHtml(
                    sale.customer ||
                    "Walk-in Customer"
                )}
            </div>

            <div>
                <strong>Payment:</strong>
                ${escapeHtml(
                    sale.paymentMethod ||
                    "—"
                )}
            </div>

            <div>
                <strong>Staff ID:</strong>
                ${escapeHtml(staffId)}
            </div>

        </div>


        <table>

            <thead>

                <tr>

                    <th>
                        Item
                    </th>

                    <th>
                        Qty
                    </th>

                    <th>
                        Price
                    </th>

                    <th>
                        Total
                    </th>

                </tr>

            </thead>


            <tbody>

                ${
                    items.map(item => `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    item.productName ||
                                    "Item"
                                )}
                            </td>

                            <td>
                                ${Number(
                                    item.quantity || 0
                                )}
                            </td>

                            <td>
                                ${money(
                                    item.unitPrice
                                )}
                            </td>

                            <td>
                                ${money(
                                    item.total
                                )}
                            </td>

                        </tr>

                    `).join("")
                }

            </tbody>

        </table>


        <div class="receipt-total">

            <p>
                <strong>Total:</strong>
                ${money(sale.total)}
            </p>

            ${
                sale.paymentMethod === "Credit"
                    ? `
                        <p>
                            <strong>
                                Amount Paid:
                            </strong>
                            ${money(amountPaid)}
                        </p>

                        <p>
                            <strong>
                                Balance Due:
                            </strong>
                            ${money(outstanding)}
                        </p>

                        <p>
                            <strong>
                                Payment Status:
                            </strong>
                            ${escapeHtml(
                                paymentStatus
                            )}
                        </p>
                    `
                    : ""
            }

            <p class="grand">
                ${money(sale.total)}
            </p>

        </div>


        <div class="receipt-footer">

            Thank you for your patronage.

            <br><br>

            +2349067075444 • +2347087471639

        </div>

    `;
}


/* =========================================================
   OPEN RECEIPT
========================================================= */

function openReceipt(sale) {

    if (!sale || !receiptModal) {
        return;
    }


    selectedSale = sale;

    renderReceipt(sale);

    receiptModal.classList.add("show");
}


/* =========================================================
   CLOSE RECEIPT
========================================================= */

function closeReceiptModal() {

    if (!receiptModal) {
        return;
    }

    receiptModal.classList.remove("show");

    selectedSale = null;
}


/* =========================================================
   PRINT RECEIPT
========================================================= */

function printSale(sale) {

    if (!sale) {
        return;
    }


    const items =
        Array.isArray(sale.items)
            ? sale.items
            : [];


    const staffId =
        sale.staffId ||
        "ADMIN";


    const amountPaid =
        Number(sale.amountPaid || 0);


    const outstanding =
        Number(
            sale.outstandingAmount ??
            sale.outstandingBalance ??
            0
        );


    const paymentStatus =
        sale.paymentStatus ||
        (
            outstanding > 0
                ? "Credit"
                : "Paid"
        );


    const itemsHtml =
        items.map(item => `

            <tr>

                <td>
                    ${escapeHtml(
                        item.productName ||
                        "Item"
                    )}
                </td>

                <td>
                    ${Number(
                        item.quantity || 0
                    )}
                </td>

                <td>
                    ${money(
                        item.unitPrice
                    )}
                </td>

                <td>
                    ${money(
                        item.total
                    )}
                </td>

            </tr>

        `).join("");


    const creditHtml =
        sale.paymentMethod === "Credit"
            ? `

                <div>
                    <strong>
                        Amount Paid:
                    </strong>
                    ${money(amountPaid)}
                </div>

                <div>
                    <strong>
                        Balance Due:
                    </strong>
                    ${money(outstanding)}
                </div>

                <div>
                    <strong>
                        Payment Status:
                    </strong>
                    ${escapeHtml(
                        paymentStatus
                    )}
                </div>

            `
            : "";


    const popup =
        window.open(
            "",
            "_blank",
            "width=700,height=800"
        );


    if (!popup) {

        alert(
            "Please allow pop-ups to reprint the receipt."
        );

        return;
    }


    popup.document.write(`

        <!DOCTYPE html>

        <html>

        <head>

            <title>
                ${escapeHtml(
                    sale.saleNumber ||
                    "Nesi Medicals Receipt"
                )}
            </title>

            <style>

                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 25px;
                    color: #111827;
                }

                .receipt {
                    max-width: 600px;
                    margin: auto;
                }

                .head {
                    text-align: center;
                    border-bottom: 1px dashed #999;
                    padding-bottom: 15px;
                    margin-bottom: 15px;
                }

                .head img {
                    width: 65px;
                    height: 65px;
                    object-fit: contain;
                }

                .head h2 {
                    margin: 5px 0;
                }

                .head p {
                    margin: 3px 0;
                    font-size: 12px;
                }

                .meta {
                    font-size: 12px;
                    line-height: 1.8;
                    margin-bottom: 15px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }

                th,
                td {
                    padding: 8px 3px;
                    border-bottom: 1px solid #eee;
                    text-align: left;
                }

                th:last-child,
                td:last-child {
                    text-align: right;
                }

                .total {
                    border-top: 1px dashed #999;
                    margin-top: 15px;
                    padding-top: 12px;
                    text-align: right;
                    font-size: 13px;
                    line-height: 1.8;
                }

                .grand {
                    font-size: 18px;
                    font-weight: bold;
                }

                .footer {
                    text-align: center;
                    border-top: 1px dashed #999;
                    margin-top: 20px;
                    padding-top: 15px;
                    font-size: 11px;
                    color: #555;
                }

                @media print {

                    body {
                        padding: 10mm;
                    }

                }

            </style>

        </head>


        <body>

            <div class="receipt">

                <div class="head">

                    <img
                        src="assets/logo.png"
                        alt="Nesi Medicals"
                    >

                    <h2>
                        Nesi Medicals
                    </h2>

                    <p>
                        & Minimart Enterprises
                    </p>

                    <p>
                        SALES RECEIPT
                    </p>

                </div>


                <div class="meta">

                    <div>
                        <strong>
                            Receipt:
                        </strong>
                        ${escapeHtml(
                            sale.saleNumber || "—"
                        )}
                    </div>

                    <div>
                        <strong>
                            Date:
                        </strong>
                        ${escapeHtml(
                            formatDate(
                                sale.createdAt
                            )
                        )}
                    </div>

                    <div>
                        <strong>
                            Customer:
                        </strong>
                        ${escapeHtml(
                            sale.customer ||
                            "Walk-in Customer"
                        )}
                    </div>

                    <div>
                        <strong>
                            Payment:
                        </strong>
                        ${escapeHtml(
                            sale.paymentMethod ||
                            "—"
                        )}
                    </div>

                    <div>
                        <strong>
                            Staff ID:
                        </strong>
                        ${escapeHtml(staffId)}
                    </div>

                </div>


                <table>

                    <thead>

                        <tr>

                            <th>
                                Item
                            </th>

                            <th>
                                Qty
                            </th>

                            <th>
                                Price
                            </th>

                            <th>
                                Total
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${itemsHtml}

                    </tbody>

                </table>


                <div class="total">

                    <div>
                        <strong>
                            Total:
                        </strong>
                        ${money(sale.total)}
                    </div>

                    ${creditHtml}

                    <div class="grand">
                        ${money(sale.total)}
                    </div>

                </div>


                <div class="footer">

                    Thank you for your patronage.

                    <br><br>

                    +2349067075444 • +2347087471639

                </div>

            </div>


            <script>

                window.onload = function() {

                    window.print();

                    window.onafterprint =
                        function() {
                            window.close();
                        };

                };

            <\/script>

        </body>

        </html>

    `);


    popup.document.close();
}


/* =========================================================
   LOAD SALES
========================================================= */

function loadSales() {

    if (!salesTable) {
        console.error(
            "Sales table element missing."
        );
        return;
    }


    if (unsubscribeSales) {
        unsubscribeSales();
        unsubscribeSales = null;
    }


    salesTable.innerHTML = `

        <tr>

            <td
                colspan="7"
                class="loading"
            >
                Loading sales...
            </td>

        </tr>

    `;


    const salesQuery =
        query(
            collection(db, "sales"),
            orderBy(
                "createdAt",
                "desc"
            )
        );


    unsubscribeSales =
        onSnapshot(

            salesQuery,

            snapshot => {

                sales =
                    snapshot.docs.map(
                        doc => ({
                            id: doc.id,
                            ...doc.data()
                        })
                    );


                renderSales();

                console.log(
                    "Sales history loaded:",
                    sales.length
                );

            },

            error => {

                console.error(
                    "Sales history error:",
                    error
                );


                /*
                   FALLBACK MESSAGE
                */

                salesTable.innerHTML = `

                    <tr>

                        <td
                            colspan="7"
                            class="empty"
                        >
                            Unable to load sales history.
                            <br><br>
                            Please refresh the page.
                        </td>

                    </tr>

                `;

            }
        );
}


/* =========================================================
   SEARCH EVENT
========================================================= */

if (searchInput) {

    searchInput.addEventListener(
        "input",
        renderSales
    );

}


/* =========================================================
   MODAL EVENTS
========================================================= */

if (closeModal) {

    closeModal.addEventListener(
        "click",
        closeReceiptModal
    );

}


if (closeModal2) {

    closeModal2.addEventListener(
        "click",
        closeReceiptModal
    );

}


if (printReceipt) {

    printReceipt.addEventListener(
        "click",
        () => {

            if (selectedSale) {
                printSale(selectedSale);
            }

        }
    );

}


if (receiptModal) {

    receiptModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                receiptModal
            ) {
                closeReceiptModal();
            }

        }
    );

}


/* =========================================================
   MOBILE MENU
========================================================= */

if (mobileMenu && sidebar) {

    mobileMenu.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "open"
            );

        }
    );

}


/* =========================================================
   LOGOUT
========================================================= */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async event => {

            event.preventDefault();

            try {

                await signOut(auth);

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

            } finally {

                window.location.href =
                    "login.html";

            }

        }
    );

}


/* =========================================================
   AUTHENTICATION
========================================================= */

onAuthStateChanged(
    auth,
    user => {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }


        if (userEmail) {

            userEmail.textContent =
                user.email ||
                "Logged in";

        }


        loadSales();

    }
);
