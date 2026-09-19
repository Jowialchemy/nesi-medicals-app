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

const salesTable =
    document.getElementById("salesTable");

const searchInput =
    document.getElementById("searchInput");

const logoutBtn =
    document.getElementById("logoutBtn");

const mobileMenu =
    document.getElementById("mobileMenu");

const sidebar =
    document.getElementById("sidebar");

const userEmail =
    document.getElementById("userEmail");

const receiptModal =
    document.getElementById("receiptModal");

const printArea =
    document.getElementById("printArea");

const closeModal =
    document.getElementById("closeModal");

const closeModal2 =
    document.getElementById("closeModal2");

const printReceiptBtn =
    document.getElementById("printReceipt");


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

    const number =
        Number(value);

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
    ).format(
        safeNumber(value)
    );
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


/* =========================================================
   DATE
========================================================= */

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

        const date =
            new Date(value);

        return Number.isNaN(
            date.getTime()
        )
            ? null
            : date;
    }

    if (
        typeof value === "string"
    ) {

        const date =
            new Date(value);

        return Number.isNaN(
            date.getTime()
        )
            ? null
            : date;
    }

    if (
        typeof value === "object" &&
        value.seconds !== undefined
    ) {

        const date =
            new Date(
                value.seconds * 1000
            );

        return Number.isNaN(
            date.getTime()
        )
            ? null
            : date;
    }

    return null;
}


function formatDate(value) {

    const date =
        getDateValue(value);

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

    const items =
        getSaleItems(sale);

    return items.reduce(
        (total, item) => {

            return (
                total +
                getItemQuantity(item)
            );

        },
        0
    );
}


/* =========================================================
   SALE TOTAL
========================================================= */

function getSaleTotal(sale) {

    return safeNumber(
        sale.total ??
        sale.grandTotal ??
        sale.amount ??
        sale.totalAmount ??
        0
    );
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


function getPaymentCustomerId(payment) {

    return (
        payment.customerId ||
        payment.customerID ||
        ""
    );
}


function getPaymentSaleId(payment) {

    return (
        payment.saleId ||
        payment.saleID ||
        payment.originalSaleId ||
        payment.originalSaleID ||
        ""
    );
}


function getPaymentSaleNumber(payment) {

    return (
        payment.saleNumber ||
        payment.saleNo ||
        payment.invoiceNumber ||
        payment.invoiceNo ||
        ""
    );
}


/* =========================================================
   FIND CREDIT PAYMENTS
========================================================= */

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

    const saleCustomerName =
        String(
            sale.customerName ||
            sale.customer ||
            ""
        )
        .trim()
        .toLowerCase();


    /*
     * First: exact sale ID / sale number
     */
    const exactMatches =
        allCreditPayments.filter(
            payment => {

                const paymentSaleId =
                    getPaymentSaleId(
                        payment
                    );

                const paymentSaleNumber =
                    getPaymentSaleNumber(
                        payment
                    );

                return (
                    (
                        saleId &&
                        paymentSaleId &&
                        String(
                            paymentSaleId
                        ) ===
                        String(saleId)
                    ) ||
                    (
                        saleNumber &&
                        paymentSaleNumber &&
                        String(
                            paymentSaleNumber
                        ) ===
                        String(saleNumber)
                    )
                );
            }
        );

    if (
        exactMatches.length > 0
    ) {

        return exactMatches;
    }


    /*
     * Your current Customer page creates
     * creditPayments using customerId only.
     *
     * Therefore, if this customer has only ONE
     * credit sale, it is safe to attach the
     * payment to that sale.
     */
    if (customerId) {

        const customerPayments =
            allCreditPayments.filter(
                payment =>
                    String(
                        getPaymentCustomerId(
                            payment
                        )
                    ) ===
                    String(customerId)
            );

        const customerCreditSales =
            allSales.filter(
                item => {

                    const method =
                        String(
                            getPaymentMethod(
                                item
                            )
                        )
                        .toLowerCase();

                    const itemCustomerId =
                        item.customerId ||
                        item.customerID ||
                        "";

                    return (
                        method.includes(
                            "credit"
                        ) &&
                        String(
                            itemCustomerId
                        ) ===
                        String(customerId)
                    );
                }
            );

        if (
            customerCreditSales.length === 1
        ) {

            return customerPayments;
        }
    }


    /*
     * Fallback for older sales where customerId
     * may not have been stored.
     */
    if (saleCustomerName) {

        const customerPayments =
            allCreditPayments.filter(
                payment => {

                    const paymentName =
                        String(
                            payment.customerName ||
                            ""
                        )
                        .trim()
                        .toLowerCase();

                    return (
                        paymentName &&
                        paymentName ===
                        saleCustomerName
                    );
                }
            );

        const customerCreditSales =
            allSales.filter(
                item => {

                    const method =
                        String(
                            getPaymentMethod(
                                item
                            )
                        )
                        .toLowerCase();

                    const itemCustomer =
                        String(
                            item.customerName ||
                            item.customer ||
                            ""
                        )
                        .trim()
                        .toLowerCase();

                    return (
                        method.includes(
                            "credit"
                        ) &&
                        itemCustomer ===
                        saleCustomerName
                    );
                }
            );

        if (
            customerCreditSales.length === 1
        ) {

            return customerPayments;
        }
    }


    return [];
}


/* =========================================================
   CREDIT STATUS
========================================================= */

function getCreditStatus(sale) {

    const total =
        getSaleTotal(sale);

    const originalPaid =
        safeNumber(
            sale.amountPaid ??
            sale.paidAmount ??
            0
        );

    const originalOutstanding =
        safeNumber(
            sale.outstandingBalance ??
            sale.balanceDue ??
            sale.amountOutstanding ??
            0
        );

    const payments =
        getPaymentsForSale(
            sale
        );

    const laterPayments =
        payments.reduce(
            (sum, payment) => {

                return (
                    sum +
                    getPaymentAmount(
                        payment
                    )
                );

            },
            0
        );


    let startingOutstanding =
        originalOutstanding;


    if (
        startingOutstanding <= 0 &&
        total > 0 &&
        originalPaid < total
    ) {

        startingOutstanding =
            total -
            originalPaid;
    }


    let currentOutstanding =
        startingOutstanding -
        laterPayments;


    if (
        currentOutstanding < 0.01
    ) {

        currentOutstanding = 0;
    }


    const totalPaid =
        originalPaid +
        laterPayments;


    let status =
        "Paid";


    if (
        currentOutstanding > 0
    ) {

        if (
            totalPaid <= 0
        ) {

            status =
                "Unpaid";

        } else {

            status =
                "Partially Paid";
        }
    }


    return {

        total,

        originalPaid,

        originalOutstanding,

        laterPayments,

        totalPaid,

        currentOutstanding,

        status,

        payments

    };
}


/* =========================================================
   LOAD SALES
========================================================= */

async function loadSales() {

    console.log(
        "Sales History: loading sales..."
    );


    const snapshot =
        await getDocs(
            collection(
                db,
                "sales"
            )
        );


    allSales = [];


    snapshot.forEach(
        doc => {

            allSales.push({

                id:
                    doc.id,

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


            return (
                dateB -
                dateA
            );
        }
    );


    console.log(
        "Sales History:",
        allSales.length,
        "sales loaded"
    );
}


/* =========================================================
   LOAD CREDIT PAYMENTS
========================================================= */

async function loadCreditPayments() {

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

                    id:
                        doc.id,

                    ...doc.data()

                });

            }
        );


        console.log(
            "Credit payments:",
            allCreditPayments.length
        );

    } catch (error) {

        console.warn(
            "Credit payments could not be loaded:",
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

    if (!salesTable) {

        console.error(
            "ERROR: #salesTable was not found."
        );

        return;
    }


    if (
        sales.length === 0
    ) {

        salesTable.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="empty"
                    style="
                        text-align:center;
                        padding:40px;
                    "
                >
                    No sales found.
                </td>
            </tr>
        `;

        return;
    }


    salesTable.innerHTML =
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
                    getSaleItemCount(
                        sale
                    );


                const total =
                    getSaleTotal(
                        sale
                    );


                const paymentMethod =
                    getPaymentMethod(
                        sale
                    );


                const isCredit =
                    String(
                        paymentMethod
                    )
                    .toLowerCase()
                    .includes(
                        "credit"
                    );


                let paymentDisplay =
                    paymentMethod;


                if (isCredit) {

                    const credit =
                        getCreditStatus(
                            sale
                        );


                    paymentDisplay = `

                        <div>
                            <span
                                class="payment"
                                style="
                                    background:#fff7ed;
                                    color:#9a3412;
                                "
                            >
                                Credit
                            </span>
                        </div>

                        <small
                            style="
                                display:block;
                                margin-top:5px;
                                font-weight:bold;
                                color:${
                                    credit.status ===
                                    "Paid"
                                        ? "#15803d"
                                        : "#d97706"
                                };
                            "
                        >
                            ${escapeHtml(
                                credit.status
                            )}
                        </small>

                    `;
                }


                return `

                    <tr>

                        <td>
                            <strong>
                                ${escapeHtml(
                                    saleNumber
                                )}
                            </strong>
                        </td>


                        <td>
                            ${escapeHtml(
                                formatDate(
                                    getSaleDate(
                                        sale
                                    )
                                )
                            )}
                        </td>


                        <td>
                            ${escapeHtml(
                                customer
                            )}
                        </td>


                        <td>
                            ${itemCount}
                        </td>


                        <td>
                            <strong
                                class="amount"
                            >
                                ${money(
                                    total
                                )}
                            </strong>
                        </td>


                        <td>
                            ${paymentDisplay}
                        </td>


                        <td>

                            <button
                                type="button"
                                class="btn btn-view view-receipt-btn"
                                data-sale-id="${escapeHtml(
                                    sale.id
                                )}"
                            >
                                View
                            </button>


                            <button
                                type="button"
                                class="btn btn-print print-receipt-btn"
                                data-sale-id="${escapeHtml(
                                    sale.id
                                )}"
                            >
                                Print
                            </button>

                        </td>

                    </tr>

                `;
            }
        )
        .join("");


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

                            openReceipt(
                                sale
                            );
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
   BUILD RECEIPT
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
        getPaymentMethod(
            sale
        );


    const total =
        getSaleTotal(
            sale
        );


    const items =
        getSaleItems(
            sale
        );


    const isCredit =
        String(
            paymentMethod
        )
        .toLowerCase()
        .includes(
            "credit"
        );


    const credit =
        isCredit
            ? getCreditStatus(
                sale
            )
            : null;


    const itemsHtml =
        items.length

            ? items.map(
                item => {

                    const name =
                        item.productName ||
                        item.name ||
                        item.product ||
                        "Product";


                    const quantity =
                        getItemQuantity(
                            item
                        );


                    const price =
                        getItemPrice(
                            item
                        );


                    const lineTotal =
                        safeNumber(
                            item.lineTotal ??
                            item.total ??
                            (
                                quantity *
                                price
                            )
                        );


                    return `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    name
                                )}
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
                                ${money(
                                    price
                                )}
                            </td>

                            <td
                                style="
                                    text-align:right;
                                "
                            >
                                ${money(
                                    lineTotal
                                )}
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


    let creditHtml =
        "";


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

                    <strong
                        style="
                            color:${
                                credit.status ===
                                "Paid"
                                    ? "#15803d"
                                    : "#d97706"
                            };
                        "
                    >
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
                            credit.originalPaid
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
                                    Later Credit Payments
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
                    src="./assets/logo.png"
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

                    ${escapeHtml(
                        saleNumber
                    )}
                </div>


                <div>
                    <strong>
                        Date:
                    </strong>

                    ${escapeHtml(
                        formatDate(
                            getSaleDate(
                                sale
                            )
                        )
                    )}
                </div>


                <div>
                    <strong>
                        Customer:
                    </strong>

                    ${escapeHtml(
                        customer
                    )}
                </div>


                <div>
                    <strong>
                        Phone:
                    </strong>

                    ${escapeHtml(
                        customerPhone
                    )}
                </div>


                <div>
                    <strong>
                        Payment:
                    </strong>

                    ${escapeHtml(
                        paymentMethod
                    )}
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

                            ${escapeHtml(
                                notes
                            )}

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


    if (printArea) {

        printArea.innerHTML =
            buildReceiptHtml(
                sale
            );
    }


    receiptModal.classList.add(
        "show"
    );
}


/* =========================================================
   CLOSE RECEIPT
========================================================= */

function closeReceipt() {

    if (receiptModal) {

        receiptModal.classList.remove(
            "show"
        );
    }
}


/* =========================================================
   PRINT RECEIPT
========================================================= */

function printReceipt(sale) {

    if (!sale) {
        return;
    }


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
                Nesi Medicals Receipt
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
                        getPaymentMethod(
                            sale
                        )
                    )
                    .toLowerCase();


                return (

                    saleNumber.includes(
                        search
                    ) ||

                    customer.includes(
                        search
                    ) ||

                    phone.includes(
                        search
                    ) ||

                    payment.includes(
                        search
                    )

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
        async event => {

            event.preventDefault();

            try {

                await signOut(
                    auth
                );

                window.location.href =
                    "./login.html";

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

if (mobileMenu) {

    mobileMenu.addEventListener(
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
   RECEIPT CLOSE BUTTONS
========================================================= */

if (closeModal) {

    closeModal.addEventListener(
        "click",
        closeReceipt
    );
}


if (closeModal2) {

    closeModal2.addEventListener(
        "click",
        closeReceipt
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

                closeReceipt();
            }
        }
    );
}


/* =========================================================
   PRINT BUTTON
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
   SEARCH
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
            "Sales History auth:",
            user
                ? user.email
                : "No user"
        );


        if (!user) {

            window.location.href =
                "./login.html";

            return;
        }


        /* Show logged-in email */
        if (userEmail) {

            userEmail.textContent =
                user.email ||
                "Logged in";
        }


        /* Show loading */
        if (salesTable) {

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
        }


        try {

            /*
             * STEP 1:
             * Load sales.
             */
            await loadSales();


            /*
             * STEP 2:
             * Display sales immediately.
             */
            renderSales(
                allSales
            );


            /*
             * STEP 3:
             * Load credit payments.
             */
            await loadCreditPayments();


            /*
             * STEP 4:
             * Refresh credit statuses.
             */
            renderSales(
                allSales
            );


            console.log(
                "Sales History ready."
            );


        } catch (error) {

            console.error(
                "Sales History error:",
                error
            );


            if (salesTable) {

                salesTable.innerHTML = `

                    <tr>

                        <td
                            colspan="7"
                            style="
                                text-align:center;
                                padding:40px;
                                color:#c62828;
                            "
                        >

                            <strong>
                                Unable to load sales.
                            </strong>

                            <br><br>

                            ${escapeHtml(
                                error.message ||
                                "Please refresh the page."
                            )}

                        </td>

                    </tr>

                `;
            }
        }

    }
);
