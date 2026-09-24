import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    onSnapshot,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const body = document.getElementById("salesBody");
const search = document.getElementById("searchInput");
const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");

const totalSales = document.getElementById("totalSales");
const todaySales = document.getElementById("todaySales");
const filteredTotal = document.getElementById("filteredTotal");

const modal = document.getElementById("receiptModal");
const receiptView = document.getElementById("receiptView");

let sales = [];
let selectedSale = null;
let unsubscribe = null;


/* =========================
   MONEY
========================= */

const money = value =>
    "₦" +
    (Number(value) || 0).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });


/* =========================
   ESCAPE HTML
========================= */

const esc = value =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");


/* =========================
   DATE
========================= */

function dateValue(value) {

    if (!value) return null;

    if (typeof value.toDate === "function") {
        return value.toDate();
    }

    if (value.seconds) {
        return new Date(value.seconds * 1000);
    }

    const date = new Date(value);

    return isNaN(date) ? null : date;
}


function formatDate(value) {

    const date = dateValue(value);

    return date
        ? date.toLocaleString("en-NG", {
            dateStyle: "medium",
            timeStyle: "short"
        })
        : "—";
}


function dateOnly(value) {

    const date = dateValue(value);

    if (!date) return "";

    const year = date.getFullYear();

    const month =
        String(date.getMonth() + 1).padStart(2, "0");

    const day =
        String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


/* =========================
   SEARCH / FILTER
========================= */

function matches(sale) {

    const q =
        search.value.trim().toLowerCase();

    const text =
        `${sale.saleNumber || ""} ${sale.customer || ""}`
            .toLowerCase();

    if (q && !text.includes(q)) {
        return false;
    }

    const date = dateOnly(sale.createdAt);

    if (
        fromDate.value &&
        (!date || date < fromDate.value)
    ) {
        return false;
    }

    if (
        toDate.value &&
        (!date || date > toDate.value)
    ) {
        return false;
    }

    return true;
}


/* =========================
   RENDER SALES TABLE
========================= */

function render() {

    const rows = sales.filter(matches);

    filteredTotal.textContent =
        money(
            rows.reduce(
                (total, sale) =>
                    total + Number(sale.total || 0),
                0
            )
        );


    if (!rows.length) {

        body.innerHTML =
            '<tr><td colspan="7" class="empty">No sales match your search or date filter.</td></tr>';

        return;
    }


    body.innerHTML = rows
        .map(sale => `

            <tr>

                <td>
                    <strong>
                        ${esc(sale.saleNumber)}
                    </strong>
                </td>

                <td>
                    ${esc(formatDate(sale.createdAt))}
                </td>

                <td>
                    ${esc(
                        sale.customer ||
                        "Walk-in Customer"
                    )}
                </td>

                <td>
                    ${Number(sale.totalQuantity || 0)}
                </td>

                <td class="money">
                    ${money(sale.total)}
                </td>

                <td>
                    <span class="badge">
                        ${esc(
                            sale.paymentMethod ||
                            "—"
                        )}
                    </span>
                </td>

                <td>

                    <div class="actions">

                        <button
                            class="btn-small"
                            data-view="${esc(sale.id)}"
                        >
                            View
                        </button>

                        <button
                            class="btn-small"
                            data-print="${esc(sale.id)}"
                        >
                            Reprint
                        </button>

                    </div>

                </td>

            </tr>

        `)
        .join("");


    body
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


    body
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


/* =========================
   RECEIPT VIEW
========================= */

function renderReceipt(sale) {

    const items =
        Array.isArray(sale.items)
            ? sale.items
            : [];


    receiptView.innerHTML = `

        <div class="receipt">

            <div class="receipt-head">

                <h2>
                    Nesi Medicals
                </h2>

                <div>
                    Medical & Minimart Enterprises
                </div>

                <small>
                    SALES RECEIPT
                </small>

            </div>


            <div class="receipt-meta">

                <strong>
                    Receipt:
                </strong>

                ${esc(sale.saleNumber)}

                <br>


                <strong>
                    Date:
                </strong>

                ${esc(formatDate(sale.createdAt))}

                <br>


                <strong>
                    Customer:
                </strong>

                ${esc(
                    sale.customer ||
                    "Walk-in Customer"
                )}

                <br>


                <strong>
                    Payment:
                </strong>

                ${esc(
                    sale.paymentMethod ||
                    "—"
                )}

                <br>


                <strong>
                    Staff ID:
                </strong>

                ${esc(
                    sale.staffId ||
                    "—"
                )}

            </div>


            <table class="receipt-table">

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

                    ${items
                        .map(item => `

                            <tr>

                                <td>
                                    ${esc(
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

                        `)
                        .join("")}

                </tbody>

            </table>


            <div class="receipt-total">

                <span>
                    Total
                </span>

                <span>
                    ${money(sale.total)}
                </span>

            </div>


            <div
                style="
                    text-align:center;
                    margin-top:25px;
                    font-size:11px;
                    color:#777;
                "
            >

                Thank you for your patronage.

            </div>

        </div>

    `;

}


/* =========================
   OPEN RECEIPT
========================= */

function openReceipt(sale) {

    if (!sale) return;

    selectedSale = sale;

    renderReceipt(sale);

    modal.classList.add("show");
}


/* =========================
   CLOSE RECEIPT
========================= */

function closeReceipt() {

    modal.classList.remove("show");

    selectedSale = null;
}


/* =========================
   PRINT / REPRINT RECEIPT
========================= */

function printSale(sale) {

    if (!sale) return;

    const items =
        Array.isArray(sale.items)
            ? sale.items
            : [];


    const windowPrint =
        window.open(
            "",
            "_blank",
            "width=700,height=800"
        );


    if (!windowPrint) {

        alert(
            "Please allow pop-ups to reprint the receipt."
        );

        return;
    }


    windowPrint.document.write(`

        <!doctype html>

        <html>

        <head>

            <title>
                ${esc(sale.saleNumber)}
            </title>


            <style>

                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 25px;
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


                .meta {
                    font-size: 12px;
                    line-height: 1.7;
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
                    display: flex;
                    justify-content: space-between;
                    font-weight: bold;
                    font-size: 16px;
                    padding-top: 14px;
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

                    <h2>
                        Nesi Medicals
                    </h2>

                    <div>
                        Medical & Minimart Enterprises
                    </div>

                    <small>
                        SALES RECEIPT
                    </small>

                </div>


                <div class="meta">

                    <b>
                        Receipt:
                    </b>

                    ${esc(sale.saleNumber)}

                    <br>


                    <b>
                        Date:
                    </b>

                    ${esc(
                        formatDate(
                            sale.createdAt
                        )
                    )}

                    <br>


                    <b>
                        Customer:
                    </b>

                    ${esc(
                        sale.customer ||
                        "Walk-in Customer"
                    )}

                    <br>


                    <b>
                        Payment:
                    </b>

                    ${esc(
                        sale.paymentMethod ||
                        "—"
                    )}

                    <br>


                    <b>
                        Staff ID:
                    </b>

                    ${esc(
                        sale.staffId ||
                        "—"
                    )}

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

                        ${items
                            .map(item => `

                                <tr>

                                    <td>
                                        ${esc(
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

                            `)
                            .join("")}

                    </tbody>

                </table>


                <div class="total">

                    <span>
                        Total
                    </span>

                    <span>
                        ${money(sale.total)}
                    </span>

                </div>


            </div>


            <script>

                window.onload = () => {

                    window.print();

                    window.onafterprint = () => {
                        window.close();
                    };

                };

            <\/script>

        </body>

        </html>

    `);


    windowPrint.document.close();

}


/* =========================
   LOAD SALES
========================= */

function load() {

    if (unsubscribe) {
        unsubscribe();
    }


    unsubscribe =
        onSnapshot(

            query(
                collection(db, "sales"),
                orderBy(
                    "createdAt",
                    "desc"
                )
            ),

            snapshot => {

                sales =
                    snapshot.docs.map(
                        document => ({
                            id: document.id,
                            ...document.data()
                        })
                    );


                totalSales.textContent =
                    sales.length;


                const today =
                    dateOnly(new Date());


                todaySales.textContent =
                    money(
                        sales
                            .filter(
                                sale =>
                                    dateOnly(
                                        sale.createdAt
                                    ) === today
                            )
                            .reduce(
                                (total, sale) =>
                                    total +
                                    Number(
                                        sale.total || 0
                                    ),
                                0
                            )
                    );


                render();

            },

            error => {

                console.error(error);

                body.innerHTML = `

                    <tr>

                        <td
                            colspan="7"
                            class="empty"
                        >

                            Unable to load sales history.
                            Check your Firebase rules/index
                            and try again.

                        </td>

                    </tr>

                `;

            }

        );

}


/* =========================
   FILTERS
========================= */

search.addEventListener(
    "input",
    render
);


fromDate.addEventListener(
    "change",
    render
);


toDate.addEventListener(
    "change",
    render
);


document
    .getElementById("clearFilters")
    .addEventListener(
        "click",
        () => {

            search.value = "";
            fromDate.value = "";
            toDate.value = "";

            render();

        }
    );


/* =========================
   RECEIPT BUTTONS
========================= */

document
    .getElementById("closeModal")
    .addEventListener(
        "click",
        closeReceipt
    );


document
    .getElementById("closeModal2")
    .addEventListener(
        "click",
        closeReceipt
    );


document
    .getElementById("printReceipt")
    .addEventListener(
        "click",
        () => printSale(selectedSale)
    );


modal.addEventListener(
    "click",
    event => {

        if (event.target === modal) {
            closeReceipt();
        }

    }
);


/* =========================
   MOBILE MENU
========================= */

document
    .getElementById("mobileMenu")
    .addEventListener(
        "click",
        () => {

            document
                .getElementById("sidebar")
                .classList
                .toggle("open");

        }
    );


/* =========================
   LOGOUT
========================= */

document
    .getElementById("logoutButton")
    .addEventListener(
        "click",
        async event => {

            event.preventDefault();

            try {

                await signOut(auth);

            } finally {

                window.location.href =
                    "login.html";

            }

        }
    );


/* =========================
   AUTH
========================= */

onAuthStateChanged(
    auth,
    user => {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }

        load();

    }
);
