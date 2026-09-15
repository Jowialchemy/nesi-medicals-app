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

    userEmail.textContent =
        user.email || "Nesi Medicals Administrator";

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

                const aTime = getTimestampMilliseconds(a.createdAt);
                const bTime = getTimestampMilliseconds(b.createdAt);

                return bTime - aTime;

            });

            renderSales(allSales);

        },

        (error) => {

            console.error("Sales history error:", error);

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


        /*
         * Count the total quantity sold.
         * Example:
         * Paracetamol × 2
         * Diclofenac × 3
         * = 5 items
         */
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


/* =========================
   OPEN RECEIPT
========================= */

function openReceipt(sale, autoPrint = false) {

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


                        /*
                         * IMPORTANT:
                         *
                         * The upgraded sales.html
                         * saves the selling price as
                         * unitPrice.
                         *
                         * Older sales may use:
                         * sellingPrice
                         * price
                         */
                        const price =
                            Number(
                                item.unitPrice ??
                                item.sellingPrice ??
                                item.price ??
                                0
                            );


                        /*
                         * The upgraded sales.html
                         * saves the line total as total.
                         *
                         * Older records may use:
                         * lineTotal
                         */
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
     * Allow the modal to appear before
     * starting the print dialog.
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

document
    .getElementById("printReceipt")
    .addEventListener("click", () => {

        if (!selectedSale) return;

        window.print();

    });


/* =========================
   CLOSE RECEIPT
========================= */

function closeModal() {

    receiptModal.classList.remove("show");

    selectedSale = null;

}


document
    .getElementById("closeModal")
    .addEventListener(
        "click",
        closeModal
    );


document
    .getElementById("closeModal2")
    .addEventListener(
        "click",
        closeModal
    );


receiptModal.addEventListener(
    "click",
    (event) => {

        if (event.target === receiptModal) {

            closeModal();

        }

    }
);


/* =========================
   LOGOUT
========================= */

document
    .getElementById("logoutBtn")
    .addEventListener(
        "click",
        async (event) => {

            event.preventDefault();

            try {

                await signOut(auth);

                window.location.href =
                    "login.html";

            } catch (error) {

                alert(
                    "Logout failed: " +
                    error.message
                );

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
                .classList.toggle("open");

        }
    );


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
                    timestamp.seconds * 1000
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

function getTimestampMilliseconds(timestamp) {

    if (!timestamp) return 0;


    try {

        if (
            timestamp.toMillis &&
            typeof timestamp.toMillis === "function"
        ) {

            return timestamp.toMillis();

        }


        if (timestamp.seconds) {

            return Number(timestamp.seconds) * 1000;

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
