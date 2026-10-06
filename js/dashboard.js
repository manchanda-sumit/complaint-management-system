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


const welcomeUser = document.getElementById("welcomeUser");
const logoutBtn = document.getElementById("logoutBtn");

const complaintForm = document.getElementById("complaintForm");
const complaintMessage = document.getElementById("complaintMessage");

const complaintsList = document.getElementById("complaintsList");

const totalComplaints =
    document.getElementById("totalComplaints");

const pendingComplaints =
    document.getElementById("pendingComplaints");

const progressComplaints =
    document.getElementById("progressComplaints");

const resolvedComplaints =
    document.getElementById("resolvedComplaints");

const dashboardTitle =
    document.getElementById("dashboardTitle");


let currentUser = null;


/* =========================
   AUTHENTICATION
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

        const userSnapshot =
            await getDoc(
                doc(db, "users", currentUser.uid)
            );


        if (userSnapshot.exists()) {

            const userData =
                userSnapshot.data();

            const name =
                userData.name || currentUser.email;


            welcomeUser.textContent =
                `Welcome, ${name}`;


            if (dashboardTitle) {

                dashboardTitle.textContent =
                    `${name}'s Dashboard`;

            }

        } else {

            welcomeUser.textContent =
                `Welcome, ${currentUser.email}`;

        }

    } catch (error) {

        console.error(
            "Error loading user:",
            error
        );

    }

}


/* =========================
   LOGOUT
========================= */

logoutBtn.addEventListener(
    "click",
    async () => {

        await signOut(auth);

        window.location.href =
            "login.html";

    }
);


/* =========================
   SUBMIT COMPLAINT
========================= */

complaintForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const title =
            document
                .getElementById("complaintTitle")
                .value
                .trim();

        const category =
            document
                .getElementById("category")
                .value;

        const priority =
            document
                .getElementById("priority")
                .value;

        const description =
            document
                .getElementById("description")
                .value
                .trim();


        try {

            complaintMessage.textContent =
                "Submitting complaint...";


            const complaintRef =
                await addDoc(
                    collection(db, "complaints"),
                    {

                        title,

                        category,

                        priority,

                        description,

                        status: "Pending",

                        userId:
                            currentUser.uid,

                        userEmail:
                            currentUser.email,

                        assignedTo: "",

                        createdAt:
                            serverTimestamp()

                    }
                );


            await addDoc(
                collection(
                    db,
                    "complaint_updates"
                ),
                {

                    complaintId:
                        complaintRef.id,

                    status:
                        "Pending",

                    message:
                        "Complaint submitted successfully.",

                    updatedBy:
                        currentUser.uid,

                    createdAt:
                        serverTimestamp()

                }
            );


            complaintMessage.textContent =
                "Complaint submitted successfully!";


            complaintForm.reset();

            await loadComplaints();


        } catch (error) {

            console.error(
                "Complaint submission error:",
                error
            );

            complaintMessage.textContent =
                "Unable to submit complaint. Please try again.";

        }

    }
);


/* =========================
   LOAD COMPLAINTS
========================= */

async function loadComplaints() {

    try {

        complaintsList.innerHTML =
            `<p class="empty-message">
                Loading complaints...
            </p>`;


        const complaintsQuery =
            query(
                collection(
                    db,
                    "complaints"
                ),

                where(
                    "userId",
                    "==",
                    currentUser.uid
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


        snapshot.forEach(
            (documentSnapshot) => {

                const complaint =
                    documentSnapshot.data();


                total++;


                if (
                    complaint.status ===
                    "Pending"
                ) {

                    pending++;

                }

                else if (
                    complaint.status ===
                    "In Progress"
                ) {

                    inProgress++;

                }

                else if (
                    complaint.status ===
                    "Resolved"
                ) {

                    resolved++;

                }


                complaintsList.appendChild(
                    createComplaintCard(
                        documentSnapshot.id,
                        complaint
                    )
                );

            }
        );


        totalComplaints.textContent =
            total;

        pendingComplaints.textContent =
            pending;

        progressComplaints.textContent =
            inProgress;

        resolvedComplaints.textContent =
            resolved;


    } catch (error) {

        console.error(
            "Error loading complaints:",
            error
        );

        complaintsList.innerHTML = `
            <p class="empty-message">
                Unable to load complaints.
            </p>
        `;

    }

}


/* =========================
   COMPLAINT CARD
========================= */

function createComplaintCard(
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

        </div>


        <p class="complaint-description">

            ${escapeHtml(
                complaint.description
            )}

        </p>


        <button
            class="history-button"
        >
            View Complaint History
        </button>


        <div class="history-panel"></div>

    `;


    const historyButton =
        card.querySelector(
            ".history-button"
        );


    const historyPanel =
        card.querySelector(
            ".history-panel"
        );


    historyButton.addEventListener(
        "click",
        async () => {

            if (
                historyPanel.classList.contains(
                    "history-open"
                )
            ) {

                historyPanel.classList.remove(
                    "history-open"
                );

                historyPanel.innerHTML = "";

                historyButton.textContent =
                    "View Complaint History";

                return;

            }


            historyButton.textContent =
                "Loading history...";


            await loadComplaintHistory(
                complaintId,
                historyPanel
            );


            historyPanel.classList.add(
                "history-open"
            );


            historyButton.textContent =
                "Hide Complaint History";

        }
    );


    return card;

}


/* =========================
   LOAD COMPLAINT HISTORY
========================= */

async function loadComplaintHistory(
    complaintId,
    container
) {

    try {

        const historyQuery =
            query(
                collection(
                    db,
                    "complaint_updates"
                ),

                where(
                    "complaintId",
                    "==",
                    complaintId
                )
            );


        const snapshot =
            await getDocs(
                historyQuery
            );


        const updates = [];


        snapshot.forEach(
            (documentSnapshot) => {

                updates.push(
                    documentSnapshot.data()
                );

            }
        );


        updates.sort(
            (a, b) => {

                const timeA =
                    a.createdAt
                        ? a.createdAt.toMillis()
                        : 0;

                const timeB =
                    b.createdAt
                        ? b.createdAt.toMillis()
                        : 0;

                return timeA - timeB;

            }
        );


        if (updates.length === 0) {

            container.innerHTML = `
                <p class="empty-message">
                    No history available.
                </p>
            `;

            return;

        }


        container.innerHTML = `

            <div class="history-title">
                Complaint History
            </div>

            <div class="history-timeline">

                ${updates.map(
                    (update) => {

                        let dateText =
                            "Recently";


                        if (
                            update.createdAt
                        ) {

                            dateText =
                                update.createdAt
                                    .toDate()
                                    .toLocaleString();

                        }


                        return `

                            <div
                                class="history-item"
                            >

                                <div
                                    class="history-dot"
                                ></div>


                                <div
                                    class="history-content"
                                >

                                    <strong>
                                        ${escapeHtml(
                                            update.status
                                        )}
                                    </strong>

                                    <p>
                                        ${escapeHtml(
                                            update.message ||
                                            ""
                                        )}
                                    </p>

                                    <small>
                                        ${dateText}
                                    </small>

                                </div>

                            </div>

                        `;

                    }
                ).join("")}

            </div>

        `;


    } catch (error) {

        console.error(
            "History error:",
            error
        );

        container.innerHTML = `
            <p class="empty-message">
                Unable to load complaint history.
            </p>
        `;

    }

}


/* =========================
   STATUS
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