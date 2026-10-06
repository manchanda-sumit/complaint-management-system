import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

import {
    collection,
    query,
    orderBy,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";


const adminLogoutBtn =
    document.getElementById(
        "adminLogoutBtn"
    );

const adminComplaintsList =
    document.getElementById(
        "adminComplaintsList"
    );


let currentAdmin = null;

let allComplaints = [];

let searchTerm = "";

let selectedStatus = "All";


/* =========================
   CREATE FILTER CONTROLS
========================= */

const filterContainer =
    document.createElement("div");


filterContainer.className =
    "admin-filter-bar";


filterContainer.innerHTML = `

    <input
        type="text"
        id="complaintSearch"
        placeholder="Search complaints by title, category or email..."
    >


    <select id="complaintStatusFilter">

        <option value="All">
            All Statuses
        </option>

        <option value="Pending">
            Pending
        </option>

        <option value="In Progress">
            In Progress
        </option>

        <option value="Resolved">
            Resolved
        </option>

    </select>

`;


adminComplaintsList.parentElement
    .insertBefore(
        filterContainer,
        adminComplaintsList
    );


const complaintSearch =
    document.getElementById(
        "complaintSearch"
    );


const complaintStatusFilter =
    document.getElementById(
        "complaintStatusFilter"
    );


/* =========================
   SEARCH
========================= */

complaintSearch.addEventListener(
    "input",
    () => {

        searchTerm =
            complaintSearch.value
                .trim()
                .toLowerCase();

        renderComplaints();

    }
);


/* =========================
   FILTER
========================= */

complaintStatusFilter.addEventListener(
    "change",
    () => {

        selectedStatus =
            complaintStatusFilter.value;

        renderComplaints();

    }
);


/* =========================
   AUTH CHECK
========================= */

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        currentAdmin = user;


        try {

            const userSnapshot =
                await getDoc(
                    doc(
                        db,
                        "users",
                        user.uid
                    )
                );


            if (
                !userSnapshot.exists()
            ) {

                window.location.href =
                    "dashboard.html";

                return;

            }


            const userData =
                userSnapshot.data();


            if (
                userData.role !==
                "admin"
            ) {

                alert(
                    "Access denied. Admin account required."
                );

                window.location.href =
                    "dashboard.html";

                return;

            }


            await loadAllComplaints();

        } catch (error) {

            console.error(
                "Admin verification error:",
                error
            );

            window.location.href =
                "dashboard.html";

        }

    }
);


/* =========================
   LOGOUT
========================= */

adminLogoutBtn.addEventListener(
    "click",
    async () => {

        await signOut(auth);

        window.location.href =
            "login.html";

    }
);


/* =========================
   LOAD COMPLAINTS
========================= */

async function loadAllComplaints() {

    try {

        adminComplaintsList.innerHTML =
            `<p class="empty-message">
                Loading complaints...
            </p>`;


        const complaintsQuery =
            query(
                collection(
                    db,
                    "complaints"
                ),

                orderBy(
                    "createdAt",
                    "desc"
                )
            );


        const snapshot =
            await getDocs(
                complaintsQuery
            );


        allComplaints = [];


        snapshot.forEach(
            (documentSnapshot) => {

                allComplaints.push({

                    id:
                        documentSnapshot.id,

                    data:
                        documentSnapshot.data()

                });

            }
        );


        updateStatistics();

        renderComplaints();


    } catch (error) {

        console.error(
            "Error loading complaints:",
            error
        );

        adminComplaintsList.innerHTML = `
            <p class="empty-message">
                Unable to load complaints.
            </p>
        `;

    }

}


/* =========================
   STATISTICS
========================= */

function updateStatistics() {

    let pending = 0;

    let progress = 0;

    let resolved = 0;


    allComplaints.forEach(
        (item) => {

            if (
                item.data.status ===
                "Pending"
            ) {

                pending++;

            }

            else if (
                item.data.status ===
                "In Progress"
            ) {

                progress++;

            }

            else if (
                item.data.status ===
                "Resolved"
            ) {

                resolved++;

            }

        }
    );


    document.getElementById(
        "adminTotal"
    ).textContent =
        allComplaints.length;


    document.getElementById(
        "adminPending"
    ).textContent =
        pending;


    document.getElementById(
        "adminProgress"
    ).textContent =
        progress;


    document.getElementById(
        "adminResolved"
    ).textContent =
        resolved;

}


/* =========================
   FILTER COMPLAINTS
========================= */

function renderComplaints() {

    const filtered =
        allComplaints.filter(
            (item) => {

                const complaint =
                    item.data;


                const searchableText = `

                    ${complaint.title || ""}

                    ${complaint.category || ""}

                    ${complaint.userEmail || ""}

                    ${complaint.priority || ""}

                    ${complaint.description || ""}

                `.toLowerCase();


                const matchesSearch =
                    searchableText.includes(
                        searchTerm
                    );


                const matchesStatus =
                    selectedStatus ===
                    "All"
                    ||
                    complaint.status ===
                    selectedStatus;


                return (
                    matchesSearch &&
                    matchesStatus
                );

            }
        );


    adminComplaintsList.innerHTML =
        "";


    if (filtered.length === 0) {

        adminComplaintsList.innerHTML = `
            <p class="empty-message">
                No complaints match your search.
            </p>
        `;

        return;

    }


    filtered.forEach(
        (item) => {

            adminComplaintsList.appendChild(

                createAdminComplaintCard(
                    item.id,
                    item.data
                )

            );

        }
    );

}


/* =========================
   ADMIN COMPLAINT CARD
========================= */

function createAdminComplaintCard(
    complaintId,
    complaint
) {

    const card =
        document.createElement("div");


    card.className =
        "complaint-card";


    let dateText = "Recently";


    if (complaint.createdAt) {

        dateText =
            complaint.createdAt
                .toDate()
                .toLocaleString();

    }


    card.innerHTML = `

        <div class="complaint-card-header">

            <div>

                <h3>
                    ${escapeHtml(
                        complaint.title
                    )}
                </h3>

                <span class="complaint-date">
                    ${dateText}
                </span>

            </div>


            <span
                class="status-badge
                ${getStatusClass(
                    complaint.status
                )}"
            >
                ${escapeHtml(
                    complaint.status
                )}
            </span>

        </div>


        <div class="complaint-meta">

            <span>
                Category:
                <strong>
                    ${escapeHtml(
                        complaint.category
                    )}
                </strong>
            </span>

            <span>
                Priority:
                <strong>
                    ${escapeHtml(
                        complaint.priority
                    )}
                </strong>
            </span>

            <span>
                User:
                <strong>
                    ${escapeHtml(
                        complaint.userEmail
                    )}
                </strong>
            </span>

        </div>


        <p class="complaint-description">

            ${escapeHtml(
                complaint.description
            )}

        </p>


        <div class="admin-update-box">

            <div class="admin-field">

                <label>
                    Complaint Status
                </label>

                <select
                    class="status-select"
                >

                    <option
                        value="Pending"
                        ${complaint.status === "Pending"
                            ? "selected"
                            : ""}
                    >
                        Pending
                    </option>

                    <option
                        value="In Progress"
                        ${complaint.status === "In Progress"
                            ? "selected"
                            : ""}
                    >
                        In Progress
                    </option>

                    <option
                        value="Resolved"
                        ${complaint.status === "Resolved"
                            ? "selected"
                            : ""}
                    >
                        Resolved
                    </option>

                </select>

            </div>


            <div class="admin-field">

                <label>
                    Admin Remark
                </label>

                <input
                    type="text"
                    class="remark-input"
                    placeholder="Enter an update or resolution note..."
                >

            </div>


            <button
                class="btn btn-primary update-complaint-btn"
            >
                Update Complaint
            </button>

        </div>

    `;


    const statusSelect =
        card.querySelector(
            ".status-select"
        );


    const remarkInput =
        card.querySelector(
            ".remark-input"
        );


    const updateButton =
        card.querySelector(
            ".update-complaint-btn"
        );


    updateButton.addEventListener(
        "click",
        async () => {

            await updateComplaint(
                complaintId,

                complaint.status,

                statusSelect.value,

                remarkInput.value.trim()
            );

        }
    );


    return card;

}


/* =========================
   UPDATE COMPLAINT
========================= */

async function updateComplaint(
    complaintId,
    oldStatus,
    newStatus,
    remark
) {

    if (
        oldStatus === newStatus &&
        !remark
    ) {

        alert(
            "Change the status or enter an admin remark."
        );

        return;

    }


    try {

        await updateDoc(
            doc(
                db,
                "complaints",
                complaintId
            ),

            {
                status: newStatus
            }
        );


        let updateMessage;


        if (remark) {

            updateMessage =
                remark;

        } else {

            updateMessage =
                `Complaint status changed from ${oldStatus} to ${newStatus}.`;

        }


        await addDoc(
            collection(
                db,
                "complaint_updates"
            ),

            {

                complaintId,

                status:
                    newStatus,

                message:
                    updateMessage,

                updatedBy:
                    currentAdmin.uid,

                createdAt:
                    serverTimestamp()

            }
        );


        await loadAllComplaints();


    } catch (error) {

        console.error(
            "Complaint update error:",
            error
        );

        alert(
            "Unable to update complaint."
        );

    }

}


/* =========================
   STATUS CLASS
========================= */

function getStatusClass(status) {

    if (
        status === "Pending"
    ) {

        return "status-pending";

    }


    if (
        status === "In Progress"
    ) {

        return "status-progress";

    }


    if (
        status === "Resolved"
    ) {

        return "status-resolved";

    }


    return "";

}


/* =========================
   HTML SAFETY
========================= */

function escapeHtml(value) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}