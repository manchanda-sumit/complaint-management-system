import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    getDocs,
    doc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";


/* =========================
   ELEMENTS
========================= */

const welcomeUser = document.getElementById("welcomeUser");
const logoutBtn = document.getElementById("logoutBtn");

const complaintForm = document.getElementById("complaintForm");
const complaintMessage = document.getElementById("complaintMessage");

const complaintsList = document.getElementById("complaintsList");

const totalComplaints = document.getElementById("totalComplaints");
const pendingComplaints = document.getElementById("pendingComplaints");
const progressComplaints = document.getElementById("progressComplaints");
const resolvedComplaints = document.getElementById("resolvedComplaints");


let currentUser = null;


/* =========================
   AUTHENTICATION CHECK
========================= */

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "login.html";

        return;
    }

    currentUser = user;

    await loadUser();

    await loadComplaints();

});


/* =========================
   LOAD USER
========================= */

async function loadUser() {

    try {

        const userRef = doc(db, "users", currentUser.uid);

        const userSnapshot = await getDoc(userRef);

        if (userSnapshot.exists()) {

            const userData = userSnapshot.data();

            welcomeUser.textContent =
                `Welcome, ${userData.name}`;

        } else {

            welcomeUser.textContent =
                `Welcome, ${currentUser.email}`;

        }

    } catch (error) {

        console.error("Error loading user:", error);

        welcomeUser.textContent =
            `Welcome, ${currentUser.email}`;

    }

}


/* =========================
   LOGOUT
========================= */

logoutBtn.addEventListener("click", async () => {

    try {

        await signOut(auth);

        window.location.href = "login.html";

    } catch (error) {

        console.error("Logout error:", error);

    }

});


/* =========================
   SUBMIT COMPLAINT
========================= */

complaintForm.addEventListener("submit", async (event) => {

    event.preventDefault();


    if (!currentUser) {

        complaintMessage.textContent =
            "Please login again.";

        return;

    }


    const title =
        document.getElementById("complaintTitle").value.trim();

    const category =
        document.getElementById("category").value;

    const priority =
        document.getElementById("priority").value;

    const description =
        document.getElementById("description").value.trim();


    try {

        complaintMessage.textContent =
            "Submitting complaint...";


        const complaintData = {

            title: title,

            category: category,

            priority: priority,

            description: description,

            status: "Pending",

            userId: currentUser.uid,

            userEmail: currentUser.email,

            assignedTo: "",

            createdAt: serverTimestamp()

        };


        const complaintRef = await addDoc(
            collection(db, "complaints"),
            complaintData
        );


        // Add first entry to complaint history

        await addDoc(
            collection(db, "complaint_updates"),
            {

                complaintId: complaintRef.id,

                status: "Pending",

                message: "Complaint submitted successfully.",

                updatedBy: currentUser.uid,

                createdAt: serverTimestamp()

            }
        );


        complaintMessage.textContent =
            "Complaint submitted successfully!";


        complaintForm.reset();


        await loadComplaints();


    } catch (error) {

        console.error("Complaint submission error:", error);

        complaintMessage.textContent =
            "Unable to submit complaint. Please try again.";

    }

});


/* =========================
   LOAD COMPLAINTS
========================= */

async function loadComplaints() {

    try {

        complaintsList.innerHTML =
            `<p class="empty-message">Loading complaints...</p>`;


        const complaintsQuery = query(

            collection(db, "complaints"),

            where("userId", "==", currentUser.uid),

            orderBy("createdAt", "desc")

        );


        const snapshot =
            await getDocs(complaintsQuery);


        let total = 0;
        let pending = 0;
        let inProgress = 0;
        let resolved = 0;


        complaintsList.innerHTML = "";


        if (snapshot.empty) {

            complaintsList.innerHTML = `
                <p class="empty-message">
                    You haven't submitted any complaints yet.
                </p>
            `;

        }


        snapshot.forEach((documentSnapshot) => {

            const complaint =
                documentSnapshot.data();


            total++;


            if (complaint.status === "Pending") {

                pending++;

            } else if (complaint.status === "In Progress") {

                inProgress++;

            } else if (complaint.status === "Resolved") {

                resolved++;

            }


            const complaintCard =
                createComplaintCard(
                    documentSnapshot.id,
                    complaint
                );


            complaintsList.appendChild(
                complaintCard
            );

        });


        totalComplaints.textContent = total;

        pendingComplaints.textContent = pending;

        progressComplaints.textContent = inProgress;

        resolvedComplaints.textContent = resolved;


    } catch (error) {

        console.error("Error loading complaints:", error);

        complaintsList.innerHTML = `
            <p class="empty-message">
                Unable to load complaints.
            </p>
        `;

    }

}


/* =========================
   CREATE COMPLAINT CARD
========================= */

function createComplaintCard(id, complaint) {

    const card =
        document.createElement("div");


    card.className =
        "complaint-card";


    let dateText = "Recently";


    if (complaint.createdAt) {

        const date =
            complaint.createdAt.toDate();

        dateText =
            date.toLocaleString();

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

        </div>


        <p class="complaint-description">
            ${escapeHtml(complaint.description)}
        </p>

        <small>
            Complaint ID: ${id}
        </small>

    `;


    return card;

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