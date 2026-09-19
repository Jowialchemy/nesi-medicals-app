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

/* =========================================================
   ELEMENTS
========================================================= */

const salesTableBody =
    document.getElementById("salesTableBody");

const searchInput =
    document.getElementById("searchInput");

const logoutBtn =
    document.getElementById("logoutBtn");

const mobileMenuBtn =
    document.getElementById("mobileMenuBtn");

const sidebar =
    document.getElementById("sidebar");

const receiptModal =
    document.getElementById("receiptModal");

const receiptContent =
    document.getElementById("receiptContent");

const closeReceiptBtn =
    document.getElementById("closeReceiptBtn");

const printReceiptBtn =
    document.getElementById("printReceiptBtn");


/* =========================================================
   DATA
========================================================= */

let allSales = [];
let allCreditPayments = [];
let currentReceiptSale = null;


/* =========================================================
   HELPERS
========================================================= */

function safeNumber(value) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}


function money(value) {

    return new Intl.NumberFormat(
        "en-NG",
        {
            style: "currency",
            currency: "NGN",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    ).format(safeNumber(value));
}


function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function getDateValue(value) {

    if (!value) {
        return null;
    }

    if (
        typeof value.toDate === "function"
    ) {
        return value.toDate();
    }

    if (
        value instanceof Date
    ) {
        return value;
    }

    if (
        typeof value === "number"
    ) {
        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? null
            : date;
    }

    if (
        typeof value === "string"
    ) {
        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? null
            : date;
    }

    if (
        typeof value === "object" &&
        value.seconds
    ) {
        const date = new Date(
            value.seconds * 1000
        );

        return Number.isNaN(date.getTime())
            ? null
            : date;
    }

    return null;
}


function formatDate(value) {

    const date = getDateValue(value);

    if (!date) {
        return "—";
    }

    return date.toLocaleString(
        "en-NG",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function formatShortDate(value) {

    const date = getDateValue(value);

    if (!date) {
        return "—";
    }

    return date.toLocaleDateString(
        "en-NG",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================================
   SALE DATE
========================================================= */

function getSaleDate(sale) {

    return (
        sale.createdAt ||
        sale.date ||
        sale.saleDate ||
        sale.timestamp ||
        null
    );
}


/* =========================================================
   SALE ITEMS
========================================================= */

function getSaleItems(sale) {

    if (
        Array.isArray(sale.items)
    ) {
        return sale.items;
    }

    if (
        Array.isArray(sale.products)
    ) {
        return sale.products;
    }

    return [];
}


function getItemQuantity(item) {

    return safeNumber(
        item.quantity ??
        item.qty ??
        0
    );
}


function getItemPrice(item) {

    return safeNumber(
        item.sellingPrice ??
        item.price ??
        item.unitPrice ??
        0
    );
}


function getSaleItemCount(sale) {

    const items = getSaleItems(sale);

    return items.reduce(
        (total, item) => {

            return total +
                getItemQuantity(item);

        },
        0
    );
}


/* =========================================================
   CREDIT PAYMENT HELPERS
========================================================= */

function getPaymentAmount(payment) {

    return safeNumber(
        payment.amount ??
        payment.amountPaid ??
        payment.paymentAmount ??
        payment.paidAmount ??
        0
    );
}


function getCreditPaymentSaleId(payment) {

    return (
        payment.saleId ||
        payment.saleID ||
        payment.originalSaleId ||
        payment.originalSaleID ||
        ""
    );
}


function getCreditPaymentSaleNumber(payment) {

    return (
        payment.saleNumber ||
        payment.saleNo ||
        payment.invoiceNumber ||
        payment.invoiceNo ||
        ""
    );
}


function getCreditPaymentCustomerId(payment) {

    return (
        payment.customerId ||
        payment.customerID ||
        ""
    );
}


/*
 * Find all payments belonging to a particular sale.
 *
 * We support several possible field names so this works
 * with the credit-payment records already created.
 */
function getPaymentsForSale(sale) {

    const saleId =
        sale.id ||
        sale.saleId ||
        "";

    const saleNumber =
        sale.saleNumber ||
        sale.saleNo ||
        sale.invoiceNumber ||
        sale.invoiceNo ||
        "";

    const customerId =
        sale.customerId ||
        sale.customerID ||
        "";

    return allCreditPayments.filter(
        payment => {

            const paymentSaleId =
                getCreditPaymentSaleId(payment);

            const paymentSaleNumber =
                getCreditPaymentSaleNumber(payment);

            const paymentCustomerId =
                getCreditPaymentCustomerId(payment);

            /*
             * Strong match: sale ID
             */
            if (
                saleId &&
                paymentSaleId &&
                paymentSaleId === saleId
            ) {
                return true;
            }

            /*
             * Strong match: sale number
             */
            if (
                saleNumber &&
                paymentSaleNumber &&
                paymentSaleNumber === saleNumber
            ) {
                return true;
            }

            /*
             * Some older payment records may only have
             * customer information. We deliberately do NOT
             * automatically attach those payments to every
             * credit sale because that could produce a wrong
             * balance.
             */
            if (
                customerId &&
                paymentCustomerId &&
                paymentCustomerId === customerId
            ) {

                /*
                 * Only use the customer match when the payment
                 * explicitly has no sale reference.
                 */
                if (
                    !paymentSaleId &&
                    !paymentSaleNumber
                ) {
                    return false;
                }
            }

            return false;
        }
    );
}


/* =========================================================
   CURRENT CREDIT BALANCE
========================================================= */

function getOriginalOutstanding(sale) {

    return safeNumber(
        sale.outstandingBalance ??
        sale.balanceDue ??
        sale.amountOutstanding ??
        0
    );
}


function getOriginalAmountPaid(sale) {

    return safeNumber(
        sale.amountPaid ??
        sale.paidAmount ??
        0
    );
}


function getSaleTotal(sale) {

    return safeNumber(
        sale.total ??
        sale.grandTotal ??
        sale.amount ??
        sale.totalAmount ??
        0
    );
}


/*
 * IMPORTANT:
 *
 * The original sale may still contain:
 *
 * outstandingBalance = 50
 *
 * even after the customer pays the ₦50 later.
 *
 * This function subtracts later credit payments from
 * that original outstanding amount.
 */
function getCreditStatus(sale) {

    const total =
        getSaleTotal(sale);

    const originalAmountPaid =
        getOriginalAmountPaid(sale);

    const originalOutstanding =
        getOriginalOutstanding(sale);

    const payments =
        getPaymentsForSale(sale);

    const laterPayments =
        payments.reduce(
            (sum, payment) => {

                return sum +
                    getPaymentAmount(payment);

            },
            0
        );

    /*
     * If the original sale has an outstanding balance,
     * use it as the starting point.
     *
     * Otherwise calculate it from total - amount paid.
     */
    let startingOutstanding =
        originalOutstanding;

    if (
        startingOutstanding <= 0 &&
        total > 0 &&
        originalAmountPaid < total
    ) {
        startingOutstanding =
            total - originalAmountPaid;
    }

    let currentOutstanding =
        startingOutstanding -
        laterPayments;

    /*
     * Prevent tiny negative floating-point values.
     */
    if (
        currentOutstanding < 0.01
    ) {
        currentOutstanding = 0;
    }

    /*
     * Total amount paid across the original
     * transaction plus later credit payments.
     */
    const totalPaid =
        originalAmountPaid +
        laterPayments;

    let status = "Paid";

    if (
        currentOutstanding > 0
    ) {

        if (
            totalPaid <= 0
        ) {
            status = "Unpaid";
        } else {
            status = "Partially Paid";
        }
    }

    /*
     * If this is a credit sale with no later payment
     * and the original balance is positive, status is
     * correctly shown as Unpaid/Partially Paid.
     */
    return {
        total,
        originalAmountPaid,
        originalOutstanding,
        laterPayments,
        totalPaid,
        currentOutstanding,
        status,
        payments
    };
}


/* =========================================================
   PAYMENT METHOD
========================================================= */

function getPaymentMethod(sale) {

    return (
        sale.paymentMethod ||
        sale.payment ||
        "Cash"
    );
}


/* =========================================================
   LOAD SALES
========================================================= */

async function loadSales() {

    try {

        console.log("Sales History: starting sales load...");

        const salesSnapshot = await getDocs(
            collection(db, "sales")
        );

        console.log(
            "Sales History: sales received:",
            salesSnapshot.size
        );

        allSales = [];

        salesSnapshot.forEach(doc => {

            allSales.push({
                id: doc.id,
                ...doc.data()
            });

        });

        allSales.sort((a, b) => {

            const dateA =
                getDateValue(
                    getSaleDate(a)
                )?.getTime() || 0;

            const dateB =
                getDateValue(
                    getSaleDate(b)
                )?.getTime() || 0;

            return dateB - dateA;
        });

        console.log(
            "Sales History: sales loaded successfully:",
            allSales.length
        );

        return true;

    } catch (error) {

        console.error(
            "SALES LOAD ERROR:",
            error
        );

        throw error;
    }
}

    const salesSnapshot =
        await getDocs(
            collection(db, "sales")
        );

    allSales = [];

    salesSnapshot.forEach(
        doc => {

            allSales.push({
                id: doc.id,
                ...doc.data()
            });

        }
    );

    allSales.sort(
        (a, b) => {

            const dateA =
                getDateValue(
                    getSaleDate(a)
                )?.getTime() || 0;

            const dateB =
                getDateValue(
                    getSaleDate(b)
                )?.getTime() || 0;

            return dateB - dateA;
        }
    );
}


/* =========================================================
   LOAD CREDIT PAYMENTS
========================================================= */

async function loadCreditPayments() {

    /*
     * If the collection does not exist yet, getDocs simply
     * returns an empty result.
     */
    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "creditPayments"
                )
            );

        allCreditPayments = [];

        snapshot.forEach(
            doc => {

                allCreditPayments.push({
                    id: doc.id,
                    ...doc.data()
                });

            }
        );

    } catch (error) {

        console.warn(
            "Credit payments collection could not be loaded:",
            error
        );

        allCreditPayments = [];
    }
}


/* =========================================================
   RENDER SALES TABLE
========================================================= */

function renderSales(
    sales = allSales
) {

    if (!salesTableBody) {
        return;
    }

    if (
        sales.length === 0
    ) {

        salesTableBody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    style="
                        text-align:center;
                        padding:30px;
                        color:#777;
                    "
                >
                    No sales found.
                </td>
            </tr>
        `;

        return;
    }

    salesTableBody.innerHTML =
        sales.map(
            sale => {

                const saleNumber =
                    sale.saleNumber ||
                    sale.saleNo ||
                    sale.invoiceNumber ||
                    sale.invoiceNo ||
                    "—";

                const customer =
                    sale.customerName ||
                    sale.customer ||
                    "Walk-in Customer";

                const itemCount =
                    getSaleItemCount(sale);

                const total =
                    getSaleTotal(sale);

                const paymentMethod =
                    getPaymentMethod(sale);

                const isCredit =
                    paymentMethod
                        .toLowerCase()
                        .includes("credit");

                let statusText =
                    sale.paymentStatus ||
                    "";

                if (isCredit) {

                    const credit =
                        getCreditStatus(sale);

                    statusText =
                        credit.status;

                } else {

                    statusText =
                        "Paid";
                }

                return `
                    <tr>

                        <td>
                            <strong>
                                ${escapeHtml(saleNumber)}
                            </strong>
                        </td>

                        <td>
                            ${escapeHtml(
                                formatDate(
                                    getSaleDate(sale)
                                )
                            )}
                        </td>

                        <td>
                            ${escapeHtml(customer)}
                        </td>

                        <td>
                            ${itemCount}
                        </td>

                        <td>
                            <strong>
                                ${money(total)}
                            </strong>
                        </td>

                        <td>
                            ${escapeHtml(
                                paymentMethod
                            )}
                        </td>

                        <td>
                            ${
                                isCredit
                                    ? `
                                        <span
                                            style="
                                                font-weight:600;
                                                color:${
                                                    statusText === "Paid"
                                                        ? "#198754"
                                                        : "#d97706"
                                                };
                                            "
                                        >
                                            ${escapeHtml(statusText)}
                                        </span>
                                      `
                                    : `
                                        <span
                                            style="
                                                color:#198754;
                                                font-weight:600;
                                            "
                                        >
                                            Paid
                                        </span>
                                      `
                            }
                        </td>

                        <td>

                            <button
                                type="button"
                                class="view-receipt-btn"
                                data-sale-id="${escapeHtml(
                                    sale.id
                                )}"
                                style="
                                    border:none;
                                    background:#0a5fff;
                                    color:white;
                                    padding:7px 10px;
                                    border-radius:6px;
                                    cursor:pointer;
                                    margin-right:5px;
                                "
                            >
                                View
                            </button>

                            <button
                                type="button"
                                class="print-receipt-btn"
                                data-sale-id="${escapeHtml(
                                    sale.id
                                )}"
                                style="
                                    border:none;
                                    background:#ff8a00;
                                    color:white;
                                    padding:7px 10px;
                                    border-radius:6px;
                                    cursor:pointer;
                                "
                            >
                                Print
                            </button>

                        </td>

                    </tr>
                `;

            }
        ).join("");

    attachReceiptButtons();
}


/* =========================================================
   RECEIPT BUTTONS
========================================================= */

function attachReceiptButtons() {

    document
        .querySelectorAll(
            ".view-receipt-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const sale =
                            allSales.find(
                                item =>
                                    item.id ===
                                    button.dataset.saleId
                            );

                        if (sale) {
                            openReceipt(sale);
                        }

                    }
                );

            }
        );


    document
        .querySelectorAll(
            ".print-receipt-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const sale =
                            allSales.find(
                                item =>
                                    item.id ===
                                    button.dataset.saleId
                            );

                        if (sale) {

                            currentReceiptSale =
                                sale;

                            printReceipt(
                                sale
                            );
                        }

                    }
                );

            }
        );
}


/* =========================================================
   RECEIPT HTML
========================================================= */

function buildReceiptHtml(sale) {

    const saleNumber =
        sale.saleNumber ||
        sale.saleNo ||
        sale.invoiceNumber ||
        sale.invoiceNo ||
        "—";

    const customer =
        sale.customerName ||
        sale.customer ||
        "Walk-in Customer";

    const customerPhone =
        sale.customerPhone ||
        sale.phone ||
        sale.customerPhoneNumber ||
        "—";

    const paymentMethod =
        getPaymentMethod(sale);

    const total =
        getSaleTotal(sale);

    const items =
        getSaleItems(sale);

    const isCredit =
        paymentMethod
            .toLowerCase()
            .includes("credit");

    const credit =
        isCredit
            ? getCreditStatus(sale)
            : null;


    const itemsHtml =
        items.length > 0

            ? items.map(
                item => {

                    const name =
                        item.productName ||
                        item.name ||
                        item.product ||
                        "Product";

                    const quantity =
                        getItemQuantity(item);

                    const price =
                        getItemPrice(item);

                    const lineTotal =
                        safeNumber(
                            item.lineTotal ??
                            item.total ??
                            (quantity * price)
                        );

                    return `
                        <tr>

                            <td>
                                ${escapeHtml(name)}
                            </td>

                            <td
                                style="
                                    text-align:center;
                                "
                            >
                                ${quantity}
                            </td>

                            <td
                                style="
                                    text-align:right;
                                "
                            >
                                ${money(price)}
                            </td>

                            <td
                                style="
                                    text-align:right;
                                "
                            >
                                ${money(lineTotal)}
                            </td>

                        </tr>
                    `;

                }
            ).join("")

            : `
                <tr>
                    <td colspan="4">
                        No item details available.
                    </td>
                </tr>
            `;


    let creditHtml = "";

    if (isCredit) {

        creditHtml = `

            <div
                style="
                    margin-top:20px;
                    padding:15px;
                    border:1px solid #ddd;
                    border-radius:8px;
                "
            >

                <h3
                    style="
                        margin:0 0 12px;
                        font-size:16px;
                    "
                >
                    Credit Payment Details
                </h3>

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        margin:6px 0;
                    "
                >
                    <span>
                        Payment Status
                    </span>

                    <strong>
                        ${escapeHtml(
                            credit.status
                        )}
                    </strong>
                </div>

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        margin:6px 0;
                    "
                >
                    <span>
                        Original Amount Paid
                    </span>

                    <strong>
                        ${money(
                            credit.originalAmountPaid
                        )}
                    </strong>
                </div>

                ${
                    credit.laterPayments > 0
                        ? `
                            <div
                                style="
                                    display:flex;
                                    justify-content:space-between;
                                    margin:6px 0;
                                "
                            >
                                <span>
                                    Credit Payments Received
                                </span>

                                <strong>
                                    ${money(
                                        credit.laterPayments
                                    )}
                                </strong>
                            </div>
                          `
                        : ""
                }

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        margin:6px 0;
                        padding-top:8px;
                        border-top:1px solid #eee;
                    "
                >
                    <span>
                        Total Paid
                    </span>

                    <strong>
                        ${money(
                            credit.totalPaid
                        )}
                    </strong>
                </div>

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        margin-top:10px;
                        padding-top:10px;
                        border-top:2px solid #222;
                        font-size:18px;
                    "
                >
                    <span>
                        BALANCE DUE
                    </span>

                    <strong>
                        ${money(
                            credit.currentOutstanding
                        )}
                    </strong>
                </div>

            </div>

        `;
    }


    const notes =
        sale.notes ||
        sale.note ||
        "";


    return `

        <div
            style="
                font-family:Arial,Helvetica,sans-serif;
                color:#222;
                max-width:700px;
                margin:0 auto;
                background:#fff;
            "
        >

            <div
                style="
                    text-align:center;
                    border-bottom:2px solid #0a5fff;
                    padding-bottom:15px;
                    margin-bottom:20px;
                "
            >

                <img
                    src="assets/logo.png"
                    alt="Nesi Medicals"
                    style="
                        width:80px;
                        height:80px;
                        object-fit:contain;
                    "
                >

                <h1
                    style="
                        margin:8px 0 3px;
                        font-size:24px;
                    "
                >
                    Nesi Medicals
                </h1>

                <div
                    style="
                        font-size:14px;
                    "
                >
                    & Minimart Enterprises
                </div>

                <div
                    style="
                        margin-top:7px;
                        font-size:13px;
                    "
                >
                    Quality Care. Essential Products.
                    Trusted Service.
                </div>

                <div
                    style="
                        margin-top:8px;
                        font-size:13px;
                    "
                >
                    +2349067075444 • +2347087471639
                </div>

            </div>


            <div
                style="
                    display:grid;
                    grid-template-columns:1fr 1fr;
                    gap:8px;
                    margin-bottom:20px;
                    font-size:14px;
                "
            >

                <div>
                    <strong>
                        Sale No:
                    </strong>
                    ${escapeHtml(saleNumber)}
                </div>

                <div>
                    <strong>
                        Date:
                    </strong>
                    ${escapeHtml(
                        formatDate(
                            getSaleDate(sale)
                        )
                    )}
                </div>

                <div>
                    <strong>
                        Customer:
                    </strong>
                    ${escapeHtml(customer)}
                </div>

                <div>
                    <strong>
                        Phone:
                    </strong>
                    ${escapeHtml(customerPhone)}
                </div>

                <div>
                    <strong>
                        Payment:
                    </strong>
                    ${escapeHtml(paymentMethod)}
                </div>

            </div>


            <table
                style="
                    width:100%;
                    border-collapse:collapse;
                    margin-bottom:20px;
                    font-size:14px;
                "
            >

                <thead>

                    <tr>

                        <th
                            style="
                                text-align:left;
                                border-bottom:1px solid #222;
                                padding:8px 5px;
                            "
                        >
                            Product
                        </th>

                        <th
                            style="
                                text-align:center;
                                border-bottom:1px solid #222;
                                padding:8px 5px;
                            "
                        >
                            Qty
                        </th>

                        <th
                            style="
                                text-align:right;
                                border-bottom:1px solid #222;
                                padding:8px 5px;
                            "
                        >
                            Price
                        </th>

                        <th
                            style="
                                text-align:right;
                                border-bottom:1px solid #222;
                                padding:8px 5px;
                            "
                        >
                            Total
                        </th>

                    </tr>

                </thead>

                <tbody>

                    ${itemsHtml}

                </tbody>

            </table>


            <div
                style="
                    text-align:right;
                    font-size:18px;
                    font-weight:bold;
                    padding-top:10px;
                    border-top:2px solid #222;
                "
            >
                TOTAL:
                ${money(total)}
            </div>


            ${creditHtml}


            ${
                notes
                    ? `
                        <div
                            style="
                                margin-top:20px;
                                padding:12px;
                                background:#f6f6f6;
                                border-radius:6px;
                                font-size:13px;
                            "
                        >
                            <strong>
                                Notes:
                            </strong>

                            ${escapeHtml(notes)}
                        </div>
                      `
                    : ""
            }


            <div
                style="
                    margin-top:30px;
                    padding-top:15px;
                    border-top:1px solid #ddd;
                    text-align:center;
                    font-size:12px;
                    color:#666;
                "
            >
                Thank you for your patronage.
                <br>
                Nesi Medicals & Minimart Enterprises
            </div>

        </div>

    `;
}


/* =========================================================
   OPEN RECEIPT
========================================================= */

function openReceipt(sale) {

    currentReceiptSale =
        sale;

    if (!receiptModal) {
        return;
    }

    if (receiptContent) {

        receiptContent.innerHTML =
            buildReceiptHtml(
                sale
            );
    }

    receiptModal.style.display =
        "flex";
}


/* =========================================================
   PRINT RECEIPT
========================================================= */

function printReceipt(sale) {

    const receiptHtml =
        buildReceiptHtml(
            sale
        );

    const printWindow =
        window.open(
            "",
            "_blank",
            "width=800,height=900"
        );

    if (!printWindow) {

        alert(
            "Please allow pop-ups to print the receipt."
        );

        return;
    }

    printWindow.document.open();

    printWindow.document.write(`
        <!DOCTYPE html>

        <html>

        <head>

            <meta charset="UTF-8">

            <title>
                Receipt ${
                    escapeHtml(
                        sale.saleNumber ||
                        sale.saleNo ||
                        ""
                    )
                }
            </title>

            <style>

                body {
                    margin: 0;
                    padding: 20px;
                    background: white;
                }

                @media print {

                    body {
                        padding: 0;
                    }

                }

            </style>

        </head>

        <body>

            ${receiptHtml}

            <script>

                window.onload = function() {

                    window.print();

                };

            <\/script>

        </body>

        </html>
    `);

    printWindow.document.close();
}


/* =========================================================
   SEARCH
========================================================= */

function searchSales() {

    const search =
        String(
            searchInput?.value || ""
        )
        .trim()
        .toLowerCase();

    if (!search) {

        renderSales(
            allSales
        );

        return;
    }

    const filtered =
        allSales.filter(
            sale => {

                const saleNumber =
                    String(
                        sale.saleNumber ||
                        sale.saleNo ||
                        sale.invoiceNumber ||
                        sale.invoiceNo ||
                        ""
                    )
                    .toLowerCase();

                const customer =
                    String(
                        sale.customerName ||
                        sale.customer ||
                        ""
                    )
                    .toLowerCase();

                const phone =
                    String(
                        sale.customerPhone ||
                        sale.phone ||
                        ""
                    )
                    .toLowerCase();

                const payment =
                    String(
                        getPaymentMethod(sale)
                    )
                    .toLowerCase();

                return (
                    saleNumber.includes(search) ||
                    customer.includes(search) ||
                    phone.includes(search) ||
                    payment.includes(search)
                );
            }
        );

    renderSales(
        filtered
    );
}


/* =========================================================
   LOGOUT
========================================================= */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async () => {

            try {

                await signOut(
                    auth
                );

                window.location.href =
                    "login.html";

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

                alert(
                    "Unable to log out. Please try again."
                );
            }

        }
    );
}


/* =========================================================
   MOBILE MENU
========================================================= */

if (mobileMenuBtn) {

    mobileMenuBtn.addEventListener(
        "click",
        () => {

            if (sidebar) {

                sidebar.classList.toggle(
                    "open"
                );

            }

        }
    );
}


/* =========================================================
   CLOSE RECEIPT
========================================================= */

if (closeReceiptBtn) {

    closeReceiptBtn.addEventListener(
        "click",
        () => {

            if (receiptModal) {

                receiptModal.style.display =
                    "none";

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

                receiptModal.style.display =
                    "none";

            }

        }
    );
}


/* =========================================================
   PRINT BUTTON IN MODAL
========================================================= */

if (printReceiptBtn) {

    printReceiptBtn.addEventListener(
        "click",
        () => {

            if (
                currentReceiptSale
            ) {

                printReceipt(
                    currentReceiptSale
                );

            }

        }
    );
}


/* =========================================================
   SEARCH EVENT
========================================================= */

if (searchInput) {

    searchInput.addEventListener(
        "input",
        searchSales
    );
}


/* =========================================================
   AUTH + INITIAL LOAD
========================================================= */

onAuthStateChanged(
    auth,
    async user => {

        console.log(
            "Sales History: Auth state:",
            user ? user.email : "No user"
        );

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }

        if (salesTableBody) {

            salesTableBody.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        style="
                            text-align:center;
                            padding:30px;
                        "
                    >
                        Loading sales...
                    </td>
                </tr>
            `;

        }

        try {

            /*
             * STEP 1
             * Load the actual sales.
             */
            await loadSales();

            /*
             * STEP 2
             * Display sales immediately.
             */
            renderSales(allSales);

            /*
             * STEP 3
             * Load credit payments separately.
             *
             * This cannot block the Sales History page.
             */
            loadCreditPayments()
                .then(() => {

                    console.log(
                        "Credit payments loaded:",
                        allCreditPayments.length
                    );

                    /*
                     * Refresh credit statuses after
                     * payment records are available.
                     */
                    renderSales(allSales);

                })
                .catch(error => {

                    console.warn(
                        "Credit payments skipped:",
                        error
                    );

                });

        } catch (error) {

            console.error(
                "Sales History failed:",
                error
            );

            if (salesTableBody) {

                salesTableBody.innerHTML = `
                    <tr>
                        <td
                            colspan="8"
                            style="
                                text-align:center;
                                padding:30px;
                                color:#c62828;
                            "
                        >

                            <strong>
                                Unable to load sales.
                            </strong>

                            <br><br>

                            Please refresh the page.

                        </td>
                    </tr>
                `;

            }

        }

    }
);
