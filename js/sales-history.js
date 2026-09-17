import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase.js";


const salesTable = document.getElementById("salesTable");
const searchInput = document.getElementById("searchInput");
const receiptModal = document.getElementById("receiptModal");
const printArea = document.getElementById("printArea");
const userEmail = document.getElementById("userEmail");

let allSales = [];
let selectedSale = null;


/* =========================
   AUTHENTICATION
========================= */

onAuthStateChanged(auth, (user) => {

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    if (userEmail) {
        userEmail.textContent =
            user.email || "Nesi Medicals Administrator";
    }

    loadSales();
});


/* =========================
   LOAD SALES FROM FIRESTORE
========================= */

function loadSales() {

    onSnapshot(
        collection(db, "sales"),

        (snapshot) => {

            allSales = [];

            snapshot.forEach((saleDoc) => {

                allSales.push({
                    id: saleDoc.id,
                    ...saleDoc.data()
                });

            });


            /*
             * Newest sales first.
             */
            allSales.sort((a, b) => {

                const aTime =
                    getTimestampMilliseconds(a.createdAt);

                const bTime =
                    getTimestampMilliseconds(b.createdAt);

                return bTime - aTime;

            });


            renderSales(allSales);

        },

        (error) => {

            console.error(
                "Sales history error:",
                error
            );

            salesTable.innerHTML = `
                <tr>
                    <td colspan="7" class="empty">
                        Unable to load sales.
                        <br><br>
                        ${escapeHtml(error.message)}
                    </td>
                </tr>
            `;

        }
    );

}


/* =========================
   RENDER SALES TABLE
========================= */

function renderSales(sales) {

    if (!sales.length) {

        salesTable.innerHTML = `
            <tr>
                <td colspan="7" class="empty">
                    No sales have been recorded yet.
                </td>
            </tr>
        `;

        return;
    }


    salesTable.innerHTML = sales.map((sale, index) => {

        const saleNumber =
            sale.saleNumber ||
            sale.id ||
            "N/A";


        const customer =
            sale.customer ||
            "Walk-in Customer";


        const items =
            Array.isArray(sale.items)
                ? sale.items
                : [];


        const itemCount = items.reduce(
            (total, item) =>
                total + Number(item.quantity || 0),
            0
        );


        const total =
            Number(
                sale.total ??
                sale.grandTotal ??
                sale.subtotal ??
                0
            );


        const payment =
            sale.paymentMethod ||
            "Cash";


        const date =
            formatDate(sale.createdAt);


        return `
            <tr>

                <td>
                    <span class="sale-number">
                        ${escapeHtml(saleNumber)}
                    </span>
                </td>

                <td>
                    ${date}
                </td>

                <td>
                    ${escapeHtml(customer)}
                </td>

                <td>
                    ${itemCount}
                </td>

                <td>
                    <span class="amount">
                        ₦${formatMoney(total)}
                    </span>
                </td>

                <td>
                    <span class="payment">
                        ${escapeHtml(payment)}
                    </span>
                </td>

                <td>

                    <button
                        class="btn btn-view"
                        data-index="${index}"
                    >
                        View
                    </button>

                    <button
                        class="btn btn-print"
                        data-index="${index}"
                    >
                        Print
                    </button>

                </td>

            </tr>
        `;

    }).join("");


    /*
     * VIEW BUTTONS
     */
    document
        .querySelectorAll(".btn-view")
        .forEach(button => {

            button.addEventListener("click", () => {

                const index =
                    Number(button.dataset.index);

                openReceipt(
                    sales[index],
                    false
                );

            });

        });


    /*
     * PRINT BUTTONS
     */
    document
        .querySelectorAll(".btn-print")
        .forEach(button => {

            button.addEventListener("click", () => {

                const index =
                    Number(button.dataset.index);

                openReceipt(
                    sales[index],
                    true
                );

            });

        });

}


/* =========================
   SEARCH SALES
========================= */

if (searchInput) {

    searchInput.addEventListener("input", () => {

        const term =
            searchInput.value
                .trim()
                .toLowerCase();


        if (!term) {

            renderSales(allSales);

            return;

        }


        const filtered =
            allSales.filter(sale => {

                const saleNumber =
                    String(
                        sale.saleNumber ||
                        sale.id ||
                        ""
                    ).toLowerCase();


                const customer =
                    String(
                        sale.customer ||
                        ""
                    ).toLowerCase();


                const customerPhone =
                    String(
                        sale.customerPhone ||
                        ""
                    ).toLowerCase();


                return (
                    saleNumber.includes(term) ||
                    customer.includes(term) ||
                    customerPhone.includes(term)
                );

            });


        renderSales(filtered);

    });

}


/* =========================
   OPEN RECEIPT
========================= */

function openReceipt(
    sale,
    autoPrint = false
) {

    selectedSale = sale;


    const items =
        Array.isArray(sale.items)
            ? sale.items
            : [];


    const saleNumber =
        sale.saleNumber ||
        sale.id ||
        "N/A";


    const customer =
        sale.customer ||
        "Walk-in Customer";


    const customerPhone =
        sale.customerPhone ||
        "";


    const payment =
        sale.paymentMethod ||
        "Cash";


    const subtotal =
        Number(
            sale.subtotal ??
            sale.total ??
            0
        );


    const total =
        Number(
            sale.total ??
            sale.grandTotal ??
            subtotal
        );


    /*
     * CREDIT SALE INFORMATION
     *
     * New sales.html saves:
     *
     * amountPaid
     * outstandingBalance
     * paymentStatus
     *
     * Older normal sales may not have these fields.
     */


    let amountPaid = 0;

    let outstandingBalance = 0;


    if (
        payment.toLowerCase() === "credit"
    ) {

        amountPaid =
            Number(
                sale.amountPaid ?? 0
            );


        /*
         * If outstandingBalance exists,
         * use it directly.
         *
         * Otherwise calculate:
         *
         * Total - Amount Paid
         */
        outstandingBalance =
            Number(
                sale.outstandingBalance ??
                Math.max(
                    0,
                    total - amountPaid
                )
            );


        /*
         * Protect against negative values.
         */
        amountPaid =
            Math.max(
                0,
                Math.min(
                    amountPaid,
                    total
                )
            );


        outstandingBalance =
            Math.max(
                0,
                outstandingBalance
            );

    }

    else {

        /*
         * For Cash / POS / Bank Transfer,
         * the full amount is considered paid.
         */
        amountPaid = total;

        outstandingBalance = 0;

    }


    /*
     * Determine payment status.
     *
     * Credit + ₦0 paid = Credit
     * Credit + partial payment = Partially Paid
     * Credit + full payment = Paid
     *
     * Non-credit = Paid
     */

    let paymentStatus;


    if (
        payment.toLowerCase() === "credit"
    ) {

        if (outstandingBalance <= 0) {

            paymentStatus = "Paid";

        }

        else if (amountPaid <= 0) {

            paymentStatus = "Credit";

        }

        else {

            paymentStatus = "Partially Paid";

        }

    }

    else {

        paymentStatus =
            sale.paymentStatus ||
            "Paid";

    }


    const date =
        formatDate(sale.createdAt);


    printArea.innerHTML = `

        <div class="receipt-header">

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
                Quality Care. Essential Products. Trusted Service.
            </p>

            <p>
                13, Angwan Dadi beside Emzy Garden,
                Abuja, FCT, Nigeria
            </p>

        </div>


        <div class="receipt-info">

            <div>
                <strong>Sale No:</strong>
                ${escapeHtml(saleNumber)}
            </div>

            <div>
                <strong>Date:</strong>
                ${date}
            </div>

            <div>
                <strong>Customer:</strong>
                ${escapeHtml(customer)}
            </div>

            ${
                customerPhone
                ?
                `
                <div>
                    <strong>Phone:</strong>
                    ${escapeHtml(customerPhone)}
                </div>
                `
                :
                ""
            }

            <div>
                <strong>Payment:</strong>
                ${escapeHtml(payment)}
            </div>

        </div>


        <table>

            <thead>

                <tr>

                    <th>
                        Product
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
                    items.length
                    ?
                    items.map(item => {

                        const name =
                            item.productName ||
                            item.name ||
                            "Product";


                        const qty =
                            Number(
                                item.quantity || 0
                            );


                        const price =
                            Number(
                                item.unitPrice ??
                                item.sellingPrice ??
                                item.price ??
                                0
                            );


                        const lineTotal =
                            Number(
                                item.total ??
                                item.lineTotal ??
                                (qty * price)
                            );


                        return `

                            <tr>

                                <td>
                                    ${escapeHtml(name)}
                                </td>

                                <td>
                                    ${qty}
                                </td>

                                <td>
                                    ₦${formatMoney(price)}
                                </td>

                                <td>
                                    ₦${formatMoney(lineTotal)}
                                </td>

                            </tr>

                        `;

                    }).join("")

                    :

                    `
                    <tr>

                        <td colspan="4">
                            No item details available
                        </td>

                    </tr>
                    `
                }

            </tbody>

        </table>


        <div class="receipt-total">

            <p>
                Subtotal:
                ₦${formatMoney(subtotal)}
            </p>

            <p class="grand">
                Total:
                ₦${formatMoney(total)}
            </p>

        </div>


        ${
            payment.toLowerCase() === "credit"
            ?
            `
            <div class="credit-summary"
                style="
                    margin-top:15px;
                    padding:12px;
                    border:1px solid #ddd;
                    border-radius:8px;
                ">

                <p>
                    <strong>Payment Status:</strong>
                    ${escapeHtml(paymentStatus)}
                </p>

                <p>
                    <strong>Amount Paid:</strong>
                    ₦${formatMoney(amountPaid)}
                </p>

                <p>
                    <strong>Outstanding Balance:</strong>
                    ₦${formatMoney(outstandingBalance)}
                </p>

                <p
                    style="
                        font-size:15px;
                        margin-top:8px;
                    "
                >
                    <strong>
                        BALANCE DUE:
                    </strong>

                    ₦${formatMoney(outstandingBalance)}
                </p>

            </div>
            `
            :
            ""
        }


        ${
            sale.notes
            ?
            `
            <div style="
                margin-top:15px;
                font-size:12px;
            ">

                <strong>Notes:</strong>

                ${escapeHtml(sale.notes)}

            </div>
            `
            :
            ""
        }


        <div class="receipt-footer">

            <p>
                Thank you for your patronage.
            </p>

            <p>
                Nesi Medicals & Minimart Enterprises
            </p>

            <p>
                +2349067075444 &nbsp; | &nbsp;
                +2347087471639
            </p>

        </div>

    `;


    receiptModal.classList.add("show");


    /*
     * Allow modal to appear before
     * opening print dialog.
     */

    if (autoPrint) {

        setTimeout(() => {

            window.print();

        }, 400);

    }

}


/* =========================
   PRINT CURRENT RECEIPT
========================= */

const printReceiptButton =
    document.getElementById("printReceipt");


if (printReceiptButton) {

    printReceiptButton.addEventListener(
        "click",
        () => {

            if (!selectedSale) return;

            window.print();

        }
    );

}


/* =========================
   CLOSE RECEIPT
========================= */

function closeModal() {

    receiptModal.classList.remove("show");

    selectedSale = null;

}


const closeModalButton =
    document.getElementById("closeModal");


if (closeModalButton) {

    closeModalButton.addEventListener(
        "click",
        closeModal
    );

}


const closeModalButton2 =
    document.getElementById("closeModal2");


if (closeModalButton2) {

    closeModalButton2.addEventListener(
        "click",
        closeModal
    );

}


receiptModal.addEventListener(
    "click",
    (event) => {

        if (
            event.target === receiptModal
        ) {

            closeModal();

        }

    }
);


/* =========================
   LOGOUT
========================= */

const logoutBtn =
    document.getElementById("logoutBtn");


if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async (event) => {

            event.preventDefault();

            try {

                await signOut(auth);

                window.location.href =
                    "login.html";

            }

            catch (error) {

                alert(
                    "Logout failed: " +
                    error.message
                );

            }

        }
    );

}


/* =========================
   MOBILE MENU
========================= */

const mobileMenu =
    document.getElementById("mobileMenu");


if (mobileMenu) {

    mobileMenu.addEventListener(
        "click",
        () => {

            const sidebar =
                document.getElementById("sidebar");


            if (sidebar) {

                sidebar.classList.toggle(
                    "open"
                );

            }

        }
    );

}


/* =========================
   FORMAT MONEY
========================= */

function formatMoney(value) {

    return Number(value || 0)
        .toLocaleString(
            "en-NG",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

}


/* =========================
   FORMAT FIREBASE DATE
========================= */

function formatDate(timestamp) {

    if (!timestamp) {

        return "Unknown date";

    }


    try {

        let date;


        if (
            timestamp.toDate &&
            typeof timestamp.toDate === "function"
        ) {

            date = timestamp.toDate();

        }

        else if (
            timestamp.seconds
        ) {

            date =
                new Date(
                    Number(timestamp.seconds) * 1000
                );

        }

        else {

            date =
                new Date(timestamp);

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

    catch {

        return "Unknown date";

    }

}


/* =========================
   TIMESTAMP → MILLISECONDS
========================= */

function getTimestampMilliseconds(
    timestamp
) {

    if (!timestamp) return 0;


    try {

        if (
            timestamp.toMillis &&
            typeof timestamp.toMillis === "function"
        ) {

            return timestamp.toMillis();

        }


        if (timestamp.seconds) {

            return (
                Number(timestamp.seconds) * 1000
            );

        }


        const parsed =
            new Date(timestamp).getTime();


        return Number.isNaN(parsed)
            ? 0
            : parsed;

    }

    catch {

        return 0;

    }

}


/* =========================
   SECURITY / HTML ESCAPING
========================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}



