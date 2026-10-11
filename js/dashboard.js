import { auth, db } from "./firebase.js";
import { showToast } from "./toast.js";

import {
  onAuthStateChanged,
  signOut,
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
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* =========================
   DOM ELEMENTS
========================= */

const welcomeUser = document.getElementById("welcomeUser");
const logoutBtn = document.getElementById("logoutBtn");

let previouslyFocusedElement = null;

const complaintForm = document.getElementById("complaintForm");
const complaintMessage = document.getElementById("complaintMessage");
const complaintsList = document.getElementById("complaintsList");

const totalComplaints = document.getElementById("totalComplaints");
const pendingComplaints = document.getElementById("pendingComplaints");
const progressComplaints = document.getElementById("progressComplaints");
const resolvedComplaints = document.getElementById("resolvedComplaints");

const dashboardTitle = document.getElementById("dashboardTitle");

/* Edit modal elements */
const editModal = document.getElementById("editComplaintModal");
const editForm = document.getElementById("editComplaintForm");
const editError = document.getElementById("editComplaintError");
const editSaveButton = document.getElementById("saveEditComplaint");

let currentUser = null;
let complaintBeingEdited = null;
let editRequestInProgress = false;

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
    const userSnapshot = await getDoc(doc(db, "users", currentUser.uid));

    if (userSnapshot.exists()) {
      const userData = userSnapshot.data();
      const name = userData.name || currentUser.email || "User";

      if (welcomeUser) {
        welcomeUser.textContent = `Welcome, ${name}`;
      }

      if (dashboardTitle) {
        dashboardTitle.textContent = `${name}'s Dashboard`;
      }
    } else if (welcomeUser) {
      welcomeUser.textContent = `Welcome, ${currentUser.email || "User"}`;
    }
  } catch (error) {
    console.error("Error loading user:", error);
    showToast("Unable to load your profile.", "error");
  }
}

/* =========================
   LOGOUT
========================= */

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "login.html";
    } catch (error) {
      console.error("Logout error:", error);
      showToast("Unable to log out. Please try again.", "error");
    }
  });
}

/* =========================
   SUBMIT COMPLAINT
========================= */

if (complaintForm) {
  complaintForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      showToast("Please log in before submitting a complaint.", "error");
      return;
    }

    const title = document.getElementById("complaintTitle").value.trim();

    const category = document.getElementById("category").value;
    const priority = document.getElementById("priority").value;

    const description = document.getElementById("description").value.trim();

    if (!title || !description) {
      showToast("Enter a complaint title and description.", "error");
      return;
    }

    try {
      if (complaintMessage) {
        complaintMessage.textContent = "Submitting complaint...";
      }

      const complaintRef = await addDoc(collection(db, "complaints"), {
        title,
        category,
        priority,
        description,
        status: "Pending",
        userId: currentUser.uid,
        userEmail: currentUser.email || "",
        assignedTo: "",
        assignedDepartment: "",
        dueDate: "",
        createdAt: serverTimestamp(),
      });

      try {
        await addDoc(collection(db, "complaint_updates"), {
          complaintId: complaintRef.id,
          status: "Pending",
          message: "Complaint submitted successfully.",
          updatedBy: currentUser.uid,
          createdAt: serverTimestamp(),
        });
      } catch (historyError) {
        // The complaint was saved even if its history entry failed.
        console.error("Initial complaint history error:", historyError);
      }

      if (complaintMessage) {
        complaintMessage.textContent = "Complaint submitted successfully!";
      }

      showToast("Your complaint has been submitted successfully.", "success");

      complaintForm.reset();
      await loadComplaints();
    } catch (error) {
      console.error("Complaint submission error:", error);

      if (complaintMessage) {
        complaintMessage.textContent =
          "Unable to submit complaint. Please try again.";
      }

      showToast("Unable to submit complaint. Please try again.", "error");
    }
  });
}

/* =========================
   LOAD COMPLAINTS
========================= */

async function loadComplaints() {
  if (!currentUser || !complaintsList) return;

  try {
    complaintsList.innerHTML =
      '<p class="empty-message">Loading complaints...</p>';

    const complaintsQuery = query(
      collection(db, "complaints"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(complaintsQuery);

    let total = 0;
    let pending = 0;
    let inProgress = 0;
    let resolved = 0;

    complaintsList.innerHTML = "";

    if (snapshot.empty) {
      complaintsList.innerHTML =
        '<p class="empty-message">You haven\'t submitted any complaints yet.</p>';
    }

    snapshot.forEach((documentSnapshot) => {
      const complaint = documentSnapshot.data();

      total++;

      if (complaint.status === "Pending") {
        pending++;
      } else if (complaint.status === "In Progress") {
        inProgress++;
      } else if (complaint.status === "Resolved") {
        resolved++;
      }

      complaintsList.appendChild(
        createComplaintCard(documentSnapshot.id, complaint),
      );
    });

    if (totalComplaints) totalComplaints.textContent = total;
    if (pendingComplaints) pendingComplaints.textContent = pending;
    if (progressComplaints) progressComplaints.textContent = inProgress;
    if (resolvedComplaints) resolvedComplaints.textContent = resolved;
  } catch (error) {
    console.error("Error loading complaints:", error);

    complaintsList.innerHTML =
      '<p class="empty-message">Unable to load complaints.</p>';

    showToast(
      "Unable to load your complaints. Please refresh and try again.",
      "error",
    );
  }
}

/* =========================
   COMPLAINT CARD
========================= */

function createComplaintCard(complaintId, complaint) {
  const card = document.createElement("div");
  card.className = "complaint-card";

  let dateText = "Recently";

  if (complaint.createdAt?.toDate) {
    dateText = complaint.createdAt.toDate().toLocaleString();
  }

  const statusSteps = ["Pending", "In Progress", "Resolved"];
  const statusIndexes = {
    Pending: 0,
    "In Progress": 1,
    Resolved: 2,
  };

  const currentStep = statusIndexes[complaint.status] ?? 0;

  const progressHTML = statusSteps
    .map((step, index) => {
      const state =
        index < currentStep
          ? "completed"
          : index === currentStep
            ? "current"
            : "";

      const marker = index < currentStep ? "✓" : index + 1;

      return `
        <div class="progress-step ${state}">
          <span class="progress-circle">${marker}</span>
          <span class="progress-label">${escapeHtml(step)}</span>
        </div>
      `;
    })
    .join("");

  const assignmentHTML =
    complaint.assignedTo || complaint.assignedDepartment
      ? `
        <span>
          Assigned to:
          <strong>${escapeHtml(
            complaint.assignedTo || complaint.assignedDepartment,
          )}</strong>
        </span>
      `
      : "";

  const dueDateHTML = complaint.dueDate
    ? `
      <span>
        Resolution due:
        <strong>${escapeHtml(complaint.dueDate)}</strong>
      </span>
    `
    : "";

  const editButtonHTML =
    complaint.status !== "Resolved"
      ? `
        <button
          type="button"
          class="btn btn-outline edit-complaint-btn"
        >
          Edit Complaint
        </button>
      `
      : `
        <span class="complaint-date">
          Resolved complaints cannot be edited.
        </span>
      `;

  card.innerHTML = `
    <div class="complaint-card-header">
      <div>
        <h3>${escapeHtml(complaint.title || "Untitled complaint")}</h3>
        <span class="complaint-date">${escapeHtml(dateText)}</span>
      </div>

      <span class="status-badge ${getStatusClass(complaint.status)}">
        ${escapeHtml(complaint.status || "Pending")}
      </span>
    </div>

    <div class="complaint-meta">
      <span>
        Category:
        <strong>${escapeHtml(complaint.category || "Other")}</strong>
      </span>

      <span>
        Priority:
        <strong>${escapeHtml(complaint.priority || "Medium")}</strong>
      </span>

      ${assignmentHTML}
      ${dueDateHTML}
    </div>

    <p class="complaint-description">
      ${escapeHtml(complaint.description || "")}
    </p>

    <div class="complaint-progress">
      <div class="progress-heading">Complaint Progress</div>

      <div class="progress-steps">
        ${progressHTML}
      </div>
    </div>

    <div class="user-complaint-actions">
      ${editButtonHTML}

      <button
        type="button"
        class="btn btn-outline delete-complaint-btn"
      >
        Delete Complaint
      </button>
    </div>

    <button type="button" class="history-button">
      View Complaint History
    </button>

    <div class="history-panel"></div>
  `;

  /* Complaint history */
  const historyButton = card.querySelector(".history-button");
  const historyPanel = card.querySelector(".history-panel");

  historyButton.addEventListener("click", async () => {
    if (historyPanel.classList.contains("history-open")) {
      historyPanel.classList.remove("history-open");
      historyPanel.innerHTML = "";
      historyButton.textContent = "View Complaint History";
      return;
    }

    historyButton.disabled = true;
    historyButton.textContent = "Loading history...";

    try {
      await loadComplaintHistory(complaintId, historyPanel);
      historyPanel.classList.add("history-open");
      historyButton.textContent = "Hide Complaint History";
    } finally {
      historyButton.disabled = false;
    }
  });

  /* Edit complaint */
  const editButton = card.querySelector(".edit-complaint-btn");

  if (editButton) {
    editButton.addEventListener("click", () => {
      if (complaint.status === "Resolved") {
        showToast("Resolved complaints cannot be edited.", "error");
        return;
      }

      openEditComplaintModal(complaintId, complaint);
    });
  }

  /* Delete complaint */
  card
    .querySelector(".delete-complaint-btn")
    .addEventListener("click", async (event) => {
      if (event.currentTarget.disabled) return;

      const confirmed = confirm(
        "Delete this complaint permanently? This action cannot be undone.",
      );

      if (!confirmed) return;

      const deleteButton = event.currentTarget;
      deleteButton.disabled = true;
      deleteButton.textContent = "Deleting...";

      try {
        const historySnapshot = await getDocs(
          query(
            collection(db, "complaint_updates"),
            where("complaintId", "==", complaintId),
          ),
        );

        for (const historyItem of historySnapshot.docs) {
          await deleteDoc(doc(db, "complaint_updates", historyItem.id));
        }

        await deleteDoc(doc(db, "complaints", complaintId));

        showToast("Complaint deleted successfully.", "success");
        await loadComplaints();
      } catch (error) {
        console.error("Delete complaint failed:", error);

        showToast(
          error.code === "permission-denied"
            ? "Deletion was denied. Check the published Firestore rules."
            : "Could not delete the complaint. Please try again.",
          "error",
        );

        deleteButton.disabled = false;
        deleteButton.textContent = "Delete Complaint";
      }
    });

  return card;
}

/* =========================
   EDIT COMPLAINT MODAL
========================= */

function openEditComplaintModal(complaintId, complaint) {
  previouslyFocusedElement = document.activeElement;
  if (!editModal || !editForm) {
    showToast(
      "The edit form is missing. Add the edit modal markup to dashboard.html.",
      "error",
    );
    return;
  }

  if (complaint.status === "Resolved") {
    showToast("Resolved complaints cannot be edited.", "error");
    return;
  }

  complaintBeingEdited = {
    id: complaintId,
    complaint,
  };

  document.getElementById("editComplaintTitle").value = complaint.title || "";

  document.getElementById("editComplaintCategory").value =
    complaint.category || "Academic";

  document.getElementById("editComplaintPriority").value =
    complaint.priority || "Medium";

  document.getElementById("editComplaintDescription").value =
    complaint.description || "";

  if (editError) editError.textContent = "";

  editModal.classList.add("modal-open");
  editModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-active");

  document.getElementById("editComplaintTitle").focus();
}

function closeEditComplaintModal() {
if (!editModal || editRequestInProgress) return;

if (editModal.contains(document.activeElement)) {
document.activeElement.blur();
}

editModal.classList.remove("modal-open");
editModal.setAttribute("aria-hidden", "true");
document.body.classList.remove("modal-active");

if (editForm) editForm.reset();
if (editError) editError.textContent = "";

complaintBeingEdited = null;

if (previouslyFocusedElement?.isConnected) {
previouslyFocusedElement.focus();
}

previouslyFocusedElement = null;
}

/* Attach modal controls only when the modal exists */
if (editModal && editForm) {
  document
    .getElementById("closeEditComplaint")
    ?.addEventListener("click", closeEditComplaintModal);

  document
    .getElementById("cancelEditComplaint")
    ?.addEventListener("click", closeEditComplaintModal);

  editModal.addEventListener("click", (event) => {
    if (event.target === editModal) {
      closeEditComplaintModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && editModal.classList.contains("modal-open")) {
      closeEditComplaintModal();
    }
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser || !complaintBeingEdited || editRequestInProgress) {
      return;
    }

    const { id, complaint } = complaintBeingEdited;

    if (complaint.status === "Resolved") {
      if (editError) {
        editError.textContent = "Resolved complaints cannot be edited.";
      }
      return;
    }

    const title = document.getElementById("editComplaintTitle").value.trim();

    const category = document.getElementById("editComplaintCategory").value;

    const priority = document.getElementById("editComplaintPriority").value;

    const description = document
      .getElementById("editComplaintDescription")
      .value.trim();

    /*
     * Keep this list aligned with the actual category options
     * in your submit and edit forms.
     */
    const allowedCategories = [
      "Academic",
      "Infrastructure",
      "Technical",
      "IT / Technical",
      "Administration",
      "Facilities",
      "Other",
    ];

    if (!title || !description) {
      if (editError) {
        editError.textContent =
          "Please enter both a complaint title and description.";
      }
      return;
    }

    if (title.length > 120 || description.length > 3000) {
      if (editError) {
        editError.textContent =
          "The title must be at most 120 characters and the description at most 3000.";
      }
      return;
    }

    if (!allowedCategories.includes(category)) {
      if (editError) {
        editError.textContent = "Please select a valid category.";
      }
      return;
    }

    if (!["Low", "Medium", "High"].includes(priority)) {
      if (editError) {
        editError.textContent = "Please select a valid priority.";
      }
      return;
    }

    editRequestInProgress = true;

    if (editSaveButton) {
      editSaveButton.disabled = true;
      editSaveButton.textContent = "Saving...";
    }

    if (editError) editError.textContent = "";

    try {
      await updateDoc(doc(db, "complaints", id), {
        title,
        category,
        priority,
        description,
        updatedAt: serverTimestamp(),
      });

      try {
        await addDoc(collection(db, "complaint_updates"), {
          complaintId: id,
          status: complaint.status,
          message: "The complainant edited the complaint details.",
          updatedBy: currentUser.uid,
          createdAt: serverTimestamp(),
        });
      } catch (historyError) {
        console.error("Complaint edit history error:", historyError);
      }

      closeEditModalAfterSave();

      showToast("Complaint updated successfully.", "success");
      await loadComplaints();
    } catch (error) {
      console.error("Edit complaint failed:", error);

      if (editError) {
        editError.textContent =
          error.code === "permission-denied"
            ? "Permission denied. Check the published Firestore rules."
            : "Could not save your changes. Please try again.";
      }
    } finally {
      editRequestInProgress = false;

      if (editSaveButton) {
        editSaveButton.disabled = false;
        editSaveButton.textContent = "Save changes";
      }
    }
  });
}

function closeEditModalAfterSave() {
if (!editModal) return;

if (editModal.contains(document.activeElement)) {
document.activeElement.blur();
}

editModal.classList.remove("modal-open");
editModal.setAttribute("aria-hidden", "true");
document.body.classList.remove("modal-active");

if (editForm) editForm.reset();
if (editError) editError.textContent = "";

complaintBeingEdited = null;

if (previouslyFocusedElement?.isConnected) {
previouslyFocusedElement.focus();
}

previouslyFocusedElement = null;
}

/* =========================
   LOAD COMPLAINT HISTORY
========================= */

async function loadComplaintHistory(complaintId, container) {
  try {
    const historyQuery = query(
      collection(db, "complaint_updates"),
      where("complaintId", "==", complaintId),
    );

    const snapshot = await getDocs(historyQuery);
    const updates = snapshot.docs.map((item) => item.data());

    updates.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() ?? 0;
      const timeB = b.createdAt?.toMillis?.() ?? 0;
      return timeA - timeB;
    });

    if (updates.length === 0) {
      container.innerHTML =
        '<p class="empty-message">No history available.</p>';
      return;
    }

    container.innerHTML = `
      <div class="history-title">Complaint History</div>

      <div class="history-timeline">
        ${updates
          .map((update) => {
            const dateText = update.createdAt?.toDate
              ? update.createdAt.toDate().toLocaleString()
              : "Recently";

            return `
              <div class="history-item">
                <div class="history-dot"></div>

                <div class="history-content">
                  <strong>${escapeHtml(update.status || "Update")}</strong>
                  <p>${escapeHtml(update.message || "")}</p>
                  <small>${escapeHtml(dateText)}</small>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  } catch (error) {
    console.error("History error:", error);

    container.innerHTML =
      '<p class="empty-message">Unable to load complaint history.</p>';

    showToast("Unable to load complaint history.", "error");
  }
}

/* =========================
   STATUS STYLING
========================= */

function getStatusClass(status) {
  if (status === "Pending") return "status-pending";
  if (status === "In Progress") return "status-progress";
  if (status === "Resolved") return "status-resolved";
  return "";
}

/* =========================
   HTML SAFETY
========================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
