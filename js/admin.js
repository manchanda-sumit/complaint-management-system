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
    document.getElementById("adminLogoutBtn");

const adminComplaintsList =
    document.getElementById("adminComplaintsList");


let currentAdmin = null;


/* =========================
   AUTH CHECK
========================= */

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "login.html";

        return;

    }

    currentAdmin = user;


    try {

        const userSnapshot = await getDoc(
            doc(db, "users", user.uid)
        );


        if (!userSnapshot.exists()) {

            window.location.href = "dashboard.html";

            return;

        }


        const userData = userSnapshot.data();


        if (userData.role !== "admin") {

            alert("Access denied. Admin account required.");

            window.location.href = "dashboard.html";

            return;

        }


        await loadAllComplaints();


    } catch (error) {

        console.error("Admin verification error:", error);

        window.location.href = "dashboard.html";

    }

});


/* =========================
   LOGOUT
========================= */

adminLogoutBtn.addEventListener(
    "click",
    async () => {

        await signOut(auth);

        window.location.href = "login.html";

    }
);


/* =========================
   LOAD ALL COMPLAINTS
========================= */

async function loadAllComplaints() {

    try {

        adminComplaintsList.innerHTML =
            `<p class="empty-message">
                Loading complaints...
            </p>`;


        const complaintsQuery = query(

            collection(db, "complaints"),

            orderBy("createdAt", "desc")

        );


        const snapshot =
            await getDocs(complaintsQuery);


        let total = 0;
        let pending = 0;
        let progress = 0;
        let resolved = 0;


        adminComplaintsList.innerHTML = "";


        if (snapshot.empty) {

            adminComplaintsList.innerHTML = `
                <p class="empty-message">
                    No complaints have been submitted yet.
                </p>
            `;

        }


        snapshot.forEach((documentSnapshot) => {

            const complaint =
                documentSnapshot.data();


            total++;


            if (complaint.status === "Pending") {

                pending++;

            }

            else if (complaint.status === "In Progress") {

                progress++;

            }

            else if (complaint.status === "Resolved") {

                resolved++;

            }


            const card =
                createAdminComplaintCard(
                    documentSnapshot.id,
                    complaint
                );


            adminComplaintsList.appendChild(card);

        });


        document.getElementById("adminTotal")
            .textContent = total;

        document.getElementById("adminPending")
            .textContent = pending;

        document.getElementById("adminProgress")
            .textContent = progress;

        document.getElementById("adminResolved")
            .textContent = resolved;


    } catch (error) {

        console.error(
            "Error loading admin complaints:",
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
   CREATE ADMIN CARD
========================= */

function createAdminComplaintCard(id, complaint) {

    const card =
        document.createElement("div");


    card.className =
        "complaint-card admin-complaint-card";


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
                    ${escapeHtml(complaint.title)}
                </h3>

                <span class="complaint-date">
                    ${dateText}
                </span>

            </div>

            <span class="status-badge ${getStatusClass(complaint.status)}">
                ${escapeHtml(complaint.status)}
            </span>

        </div>


        <div class="complaint-meta">

            <span>
                Category:
                <strong>
                    ${escapeHtml(complaint.category)}
                </strong>
            </span>

            <span>
                Priority:
                <strong>
                    ${escapeHtml(complaint.priority)}
                </strong>
            </span>

            <span>
                User:
                <strong>
                    ${escapeHtml(complaint.userEmail)}
                </strong>
            </span>

        </div>


        <p class="complaint-description">

            ${escapeHtml(complaint.description)}

        </p>


        <div class="admin-actions">

            <label>
                Update Status
            </label>

            <select class="status-select">

                <option value="Pending"
                    ${complaint.status === "Pending" ? "selected" : ""}>
                    Pending
                </option>

                <option value="In Progress"
                    ${complaint.status === "In Progress" ? "selected" : ""}>
                    In Progress
                </option>

                <option value="Resolved"
                    ${complaint.status === "Resolved" ? "selected" : ""}>
                    Resolved
                </option>

            </select>


            <button class="btn btn-primary update-status-btn">

                Update

            </button>

        </div>

    `;


    const statusSelect =
        card.querySelector(".status-select");


    const updateButton =
        card.querySelector(".update-status-btn");


    updateButton.addEventListener(
        "click",
        async () => {

            await updateComplaintStatus(
                id,
                complaint.status,
                statusSelect.value
            );

        }
    );


    return card;

}


/* =========================
   UPDATE STATUS
========================= */

async function updateComplaintStatus(
    complaintId,
    oldStatus,
    newStatus
) {

    if (oldStatus === newStatus) {

        return;

    }


    try {

        await updateDoc(
            doc(db, "complaints", complaintId),
            {
                status: newStatus
            }
        );


        await addDoc(
            collection(db, "complaint_updates"),
            {

                complaintId: complaintId,

                status: newStatus,

                message:
                    `Complaint status changed from ${oldStatus} to ${newStatus}.`,

                updatedBy: currentAdmin.uid,

                createdAt: serverTimestamp()

            }
        );


        await loadAllComplaints();


    } catch (error) {

        console.error(
            "Status update error:",
            error
        );

        alert(
            "Unable to update complaint status."
        );

    }

}


/* =========================
   STATUS CLASS
========================= */

function getStatusClass(status) {

    if (status === "Pending") {

        return "status-pending";

    }


    if (status === "In Progress") {

        return "status-progress";

    }


    if (status === "Resolved") {

        return "status-resolved";

    }


    return "";

}


/* =========================
   HTML SAFETY
========================= */

function escapeHtml(value) {

    return String(value)

        .replaceAll("&", "&amp;")

        .replaceAll("<", "&lt;")

        .replaceAll(">", "&gt;")

        .replaceAll('"', "&quot;")

        .replaceAll("'", "&#039;");

}