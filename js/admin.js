import { auth, db } from "./firebase.js";
import { showToast } from "./toast.js";

import {
  onAuthStateChanged,
  signOut,
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
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* =========================
   DOM ELEMENTS AND STATE
========================= */

const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const adminComplaintsList = document.getElementById("adminComplaintsList");

let currentAdmin = null;
let allComplaints = [];
let searchTerm = "";
let selectedStatus = "All";
let selectedPriority = "All";
let selectedAssignment = "All";
let loadingComplaints = false;

const categories = [
  "Academic",
  "Infrastructure",
  "IT / Technical",
  "Administration",
  "Facilities",
  "Other",
];

/* =========================
   LOGOUT
========================= */

if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener("click", async () => {
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
   ADMIN AUTHENTICATION
========================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const profileSnapshot = await getDoc(
      doc(db, "users", user.uid)
    );

    if (
      !profileSnapshot.exists() ||
      profileSnapshot.data().role !== "admin"
    ) {
      showToast("Admin access is required.", "error");
      window.location.href = "dashboard.html";
      return;
    }

    currentAdmin = user;

    if (!adminComplaintsList) {
      console.error("Missing #adminComplaintsList in admin.html.");
      showToast("The admin complaint list is missing.", "error");
      return;
    }

    setupComplaintFilters();
    await loadAllComplaints();
  } catch (error) {
    console.error("Admin authentication failed:", error);

    if (adminComplaintsList) {
      adminComplaintsList.innerHTML =
        '<p class="empty-message">Unable to verify admin access. Check your connection and Firestore permissions.</p>';
    }

    showToast(
      "Could not verify admin access. Please refresh and try again.",
      "error"
    );
  }
});

/* =========================
   COMPLAINT FILTERS
========================= */

function setupComplaintFilters() {
  if (!adminComplaintsList?.parentElement) return;

  // Avoid inserting the same filters twice.
  if (document.getElementById("complaintSearch")) return;

  const filterContainer = document.createElement("div");
  filterContainer.className = "admin-filter-bar";

  filterContainer.innerHTML = `
    <input
      type="search"
      id="complaintSearch"
      placeholder="Search title, category, email, assignee..."
      aria-label="Search complaints"
    >

    <select id="complaintStatusFilter" aria-label="Filter by status">
      <option value="All">All statuses</option>
      <option value="Pending">Pending</option>
      <option value="In Progress">In Progress</option>
      <option value="Resolved">Resolved</option>
    </select>

    <select id="complaintPriorityFilter" aria-label="Filter by priority">
      <option value="All">All priorities</option>
      <option value="High">High</option>
      <option value="Medium">Medium</option>
      <option value="Low">Low</option>
    </select>

    <select id="complaintAssignmentFilter" aria-label="Filter by assignment">
      <option value="All">All assignments</option>
      <option value="Assigned">Assigned</option>
      <option value="Unassigned">Unassigned</option>
    </select>
  `;

  adminComplaintsList.parentElement.insertBefore(
    filterContainer,
    adminComplaintsList
  );

  document
    .getElementById("complaintSearch")
    ?.addEventListener("input", (event) => {
      searchTerm = event.target.value.trim().toLowerCase();
      renderComplaints();
    });

  document
    .getElementById("complaintStatusFilter")
    ?.addEventListener("change", (event) => {
      selectedStatus = event.target.value;
      renderComplaints();
    });

  document
    .getElementById("complaintPriorityFilter")
    ?.addEventListener("change", (event) => {
      selectedPriority = event.target.value;
      renderComplaints();
    });

  document
    .getElementById("complaintAssignmentFilter")
    ?.addEventListener("change", (event) => {
      selectedAssignment = event.target.value;
      renderComplaints();
    });
}

/* =========================
   LOAD ALL COMPLAINTS
========================= */

async function loadAllComplaints() {
  if (!adminComplaintsList || loadingComplaints) return;

  loadingComplaints = true;
  adminComplaintsList.innerHTML =
    '<p class="empty-message">Loading complaints...</p>';

  try {
    const snapshot = await getDocs(
      query(
        collection(db, "complaints"),
        orderBy("createdAt", "desc")
      )
    );

    allComplaints = snapshot.docs.map((item) => ({
      id: item.id,
      data: item.data(),
    }));

    updateStatistics();
    renderComplaints();

    try {
      renderAnalytics();
      updateReportSummary();
    } catch (uiError) {
      console.error("Analytics/report rendering error:", uiError);
    }
  } catch (error) {
    console.error("Error loading complaints:", error);

    adminComplaintsList.innerHTML =
      '<p class="empty-message">Unable to load complaints. Check your Firestore rules, connection, and browser Console.</p>';

    showToast(
      error.code === "permission-denied"
        ? "Permission denied when loading complaints. Check your Firestore rules."
        : "Unable to load complaints. Check the connection and try again.",
      "error"
    );
  } finally {
    loadingComplaints = false;
  }
}

/* =========================
   STATISTICS
========================= */

function updateStatistics() {
  const count = (status) =>
    allComplaints.filter(({ data }) => data.status === status).length;

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  };

  setText("adminTotal", allComplaints.length);
  setText("adminPending", count("Pending"));
  setText("adminProgress", count("In Progress"));
  setText("adminResolved", count("Resolved"));

  const now = new Date();

  const overdue = allComplaints.filter(({ data }) => {
    if (!data.dueDate || data.status === "Resolved") return false;

    const dueDate = new Date(`${data.dueDate}T23:59:59`);
    return !Number.isNaN(dueDate.getTime()) && dueDate < now;
  }).length;

  let overdueMetric = document.getElementById("adminOverdue");

  if (!overdueMetric) {
    const stats = document.querySelector(".dashboard-stats");

    if (stats) {
      const card = document.createElement("div");
      card.className = "stat-card";
      card.innerHTML = `
        <span class="stat-label">Overdue</span>
        <strong id="adminOverdue">0</strong>
      `;

      stats.appendChild(card);
      overdueMetric = card.querySelector("#adminOverdue");
    }
  }

  if (overdueMetric) {
    overdueMetric.textContent = String(overdue);
  }
}

/* =========================
   FILTER AND RENDER COMPLAINTS
========================= */

function renderComplaints() {
  if (!adminComplaintsList) return;

  const filtered = allComplaints.filter(({ data: complaint }) => {
    const searchableText = [
      complaint.title,
      complaint.category,
      complaint.userEmail,
      complaint.priority,
      complaint.description,
      complaint.assignedTo,
      complaint.assignedDepartment,
    ]
      .join(" ")
      .toLowerCase();

    const isAssigned = Boolean(
      complaint.assignedTo || complaint.assignedDepartment
    );

    return (
      searchableText.includes(searchTerm) &&
      (selectedStatus === "All" ||
        complaint.status === selectedStatus) &&
      (selectedPriority === "All" ||
        complaint.priority === selectedPriority) &&
      (selectedAssignment === "All" ||
        (selectedAssignment === "Assigned" && isAssigned) ||
        (selectedAssignment === "Unassigned" && !isAssigned))
    );
  });

  adminComplaintsList.innerHTML = "";

  if (!filtered.length) {
    adminComplaintsList.innerHTML =
      '<p class="empty-message">No complaints match these filters.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  filtered.forEach(({ id, data }) => {
    fragment.appendChild(createAdminComplaintCard(id, data));
  });

  adminComplaintsList.appendChild(fragment);
}

/* =========================
   COMPLAINT CARD
========================= */

function createAdminComplaintCard(id, complaint) {
  const card = document.createElement("article");
  card.className = "complaint-card";

  const submittedAt = complaint.createdAt?.toDate
    ? complaint.createdAt.toDate().toLocaleString()
    : "Recently";

  const overdue = isOverdue(complaint);

  card.innerHTML = `
    <div class="complaint-card-header">
      <div>
        <h3>${escapeHTML(complaint.title || "Untitled complaint")}</h3>
        <span class="complaint-date">
          Submitted ${escapeHTML(submittedAt)}
        </span>
      </div>

      <span class="status-badge ${statusClass(complaint.status)}">
        ${escapeHTML(complaint.status || "Pending")}
      </span>
    </div>

    <div class="complaint-meta">
      <span>
        Category:
        <strong>${escapeHTML(complaint.category || "—")}</strong>
      </span>

      <span>
        Priority:
        <strong>${escapeHTML(complaint.priority || "—")}</strong>
      </span>

      <span>
        User:
        <strong>${escapeHTML(complaint.userEmail || "—")}</strong>
      </span>
    </div>

    <p class="complaint-description">
      ${escapeHTML(complaint.description || "")}
    </p>

    <div class="admin-assignment-grid">
      <div class="admin-field">
        <label>Assign to staff/member</label>
        <input
          class="assigned-to"
          maxlength="100"
          placeholder="Name or email"
          value="${escapeHTML(complaint.assignedTo || "")}"
        >
      </div>

      <div class="admin-field">
        <label>Department</label>
        <select class="assigned-department">
          <option value="">Unassigned</option>
          ${categories
            .map(
              (category) => `
                <option
                  value="${escapeHTML(category)}"
                  ${complaint.assignedDepartment === category ? "selected" : ""}
                >${escapeHTML(category)}</option>
              `
            )
            .join("")}
        </select>
      </div>

      <div class="admin-field">
        <label>Resolution due date</label>
        <input
          type="date"
          class="due-date"
          value="${escapeHTML(complaint.dueDate || "")}"
        >
      </div>

      <div class="admin-field">
        <label>Complaint status</label>
        <select class="status-select">
          ${["Pending", "In Progress", "Resolved"]
            .map(
              (status) => `
                <option
                  value="${status}"
                  ${complaint.status === status ? "selected" : ""}
                >${status}</option>
              `
            )
            .join("")}
        </select>
      </div>

      <div class="admin-field admin-remark-field">
        <label>Admin remark / update</label>
        <textarea
          class="remark-input"
          rows="2"
          maxlength="1000"
          placeholder="Add an update visible in complaint history..."
        ></textarea>
      </div>
    </div>

    <p class="deadline-indicator ${overdue ? "deadline-overdue" : ""}">
      ${
        complaint.dueDate
          ? `${overdue ? "OVERDUE · " : "Due date: "}${escapeHTML(complaint.dueDate)}`
          : "No resolution deadline set"
      }
    </p>

    <button type="button" class="btn btn-primary update-complaint-btn">
      Save admin updates
    </button>
  `;

  const saveButton = card.querySelector(".update-complaint-btn");

  saveButton.addEventListener("click", async () => {
    if (saveButton.disabled) return;

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      await saveAdminUpdates(id, complaint, card);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save admin updates";
    }
  });

  return card;
}

/* =========================
   SAVE ADMIN UPDATES
========================= */

async function saveAdminUpdates(id, oldComplaint, card) {
  if (!currentAdmin) {
    showToast("Your admin session has expired. Please log in again.", "error");
    return;
  }

  const status = card.querySelector(".status-select").value;
  const remark = card.querySelector(".remark-input").value.trim();
  const assignedTo = card.querySelector(".assigned-to").value.trim();
  const assignedDepartment =
    card.querySelector(".assigned-department").value;
  const dueDate = card.querySelector(".due-date").value;

  if (!["Pending", "In Progress", "Resolved"].includes(status)) {
    showToast("Please select a valid complaint status.", "error");
    return;
  }

  if (
    assignedTo.length > 100 ||
    remark.length > 1000
  ) {
    showToast("Some fields exceed their permitted length.", "error");
    return;
  }

  if (dueDate && Number.isNaN(new Date(`${dueDate}T00:00:00`).getTime())) {
    showToast("Please select a valid due date.", "error");
    return;
  }

  const changedStatus = status !== (oldComplaint.status || "Pending");

  const assignmentChanged =
    assignedTo !== (oldComplaint.assignedTo || "") ||
    assignedDepartment !== (oldComplaint.assignedDepartment || "");

  const dueChanged = dueDate !== (oldComplaint.dueDate || "");

  if (!changedStatus && !assignmentChanged && !dueChanged && !remark) {
    showToast("Nothing to save. Change a field or add a remark.", "info");
    return;
  }

  const messages = [];

  if (changedStatus) {
    messages.push(
      `Status changed from ${oldComplaint.status || "Pending"} to ${status}.`
    );
  }

  if (assignmentChanged) {
    messages.push(
      `Assignment updated: ${assignedTo || "No staff member"}${
        assignedDepartment ? ` · ${assignedDepartment}` : ""
      }.`
    );
  }

  if (dueChanged) {
    messages.push(
      dueDate
        ? `Resolution due date set to ${dueDate}.`
        : "Resolution due date removed."
    );
  }

  if (remark) {
    messages.push(`Admin remark: ${remark}`);
  }

  /*
   * Save the primary complaint first.
   * History and notification writes are separate operations, so report
   * partial failures instead of falsely claiming every write succeeded.
   */
  try {
    await updateDoc(doc(db, "complaints", id), {
      status,
      assignedTo,
      assignedDepartment,
      dueDate,
      updatedAt: serverTimestamp(),
      resolvedAt: status === "Resolved" ? serverTimestamp() : null,
    });
  } catch (error) {
    console.error("Complaint update failed:", error);

    showToast(
      error.code === "permission-denied"
        ? "Permission denied. Check your Firestore rules."
        : "Unable to save complaint changes. Please try again.",
      "error"
    );

    return;
  }

  let historyFailed = false;
  let notificationFailed = false;

  for (const message of messages) {
    try {
      await addDoc(collection(db, "complaint_updates"), {
        complaintId: id,
        status,
        message,
        updatedBy: currentAdmin.uid,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      historyFailed = true;
      console.error("Complaint history write failed:", error);
      break;
    }
  }

  if (oldComplaint.userId && messages.length) {
    const title = changedStatus
      ? `Complaint status: ${status}`
      : assignmentChanged
        ? "Complaint assignment updated"
        : dueChanged
          ? "Resolution due date updated"
          : "New admin remark";

    try {
      await addDoc(collection(db, "notifications"), {
        recipientId: oldComplaint.userId,
        createdBy: currentAdmin.uid,
        title,
        message: `Update for "${oldComplaint.title || "your complaint"}": ${messages.join(" ")}`,
        type: changedStatus
          ? "complaint_status"
          : assignmentChanged
            ? "complaint_assignment"
            : dueChanged
              ? "complaint_due_date"
              : "admin_remark",
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      notificationFailed = true;
      console.error("Notification creation failed:", error);
    }
  }

  // Clear the remark after saving so it isn't accidentally resubmitted.
  const remarkInput = card.querySelector(".remark-input");
  if (remarkInput) remarkInput.value = "";

  await loadAllComplaints();

  if (historyFailed || notificationFailed) {
    showToast(
      `Complaint changes were saved, but ${
        historyFailed && notificationFailed
          ? "history and notification creation"
          : historyFailed
            ? "history creation"
            : "notification creation"
      } failed. Check the Console and Firestore rules.`,
      "error"
    );
    return;
  }

  showToast("Admin updates saved successfully.", "success");
}

/* =========================
   STATUS AND DATE HELPERS
========================= */

function statusClass(status) {
  if (status === "Pending") return "status-pending";
  if (status === "In Progress") return "status-progress";
  if (status === "Resolved") return "status-resolved";
  return "";
}

function isOverdue(complaint) {
  if (!complaint.dueDate || complaint.status === "Resolved") {
    return false;
  }

  const dueDate = new Date(`${complaint.dueDate}T23:59:59`);

  return !Number.isNaN(dueDate.getTime()) && dueDate < new Date();
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

/* =========================
   ANALYTICS
========================= */

function renderAnalytics() {
  const complaints = allComplaints.map(({ data }) => data);
  const total = complaints.length;

  renderBarGroup("statusAnalytics", [
    ["Pending", complaints.filter((c) => c.status === "Pending").length],
    ["In Progress", complaints.filter((c) => c.status === "In Progress").length],
    ["Resolved", complaints.filter((c) => c.status === "Resolved").length],
  ]);

  const categoryNames = new Set(categories);

  complaints.forEach((complaint) => {
    if (complaint.category) categoryNames.add(complaint.category);
  });

  renderBarGroup(
    "categoryAnalytics",
    [...categoryNames].map((category) => [
      category,
      complaints.filter((c) => c.category === category).length,
    ])
  );

  renderBarGroup("priorityAnalytics", [
    ["High", complaints.filter((c) => c.priority === "High").length],
    ["Medium", complaints.filter((c) => c.priority === "Medium").length],
    ["Low", complaints.filter((c) => c.priority === "Low").length],
  ]);

  const resolved = complaints.filter(
    (c) => c.status === "Resolved"
  ).length;

  const overdue = complaints.filter(isOverdue).length;

  const resolutionRate = total
    ? Math.round((resolved / total) * 100)
    : 0;

  const resolutionContainer =
    document.getElementById("resolutionAnalytics");

  if (resolutionContainer) {
    resolutionContainer.innerHTML = `
      <div class="resolution-metric">
        <span>Resolution rate</span>
        <strong>${resolutionRate}%</strong>
      </div>

      <div class="resolution-metric">
        <span>Resolved complaints</span>
        <strong>${resolved}</strong>
      </div>

      <div class="resolution-metric">
        <span>Overdue unresolved</span>
        <strong>${overdue}</strong>
      </div>
    `;
  }
}

function renderBarGroup(containerId, entries) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const maxValue = Math.max(1, ...entries.map((entry) => entry[1]));

  container.innerHTML = entries
    .map(([label, count]) => {
      const width = Math.round((count / maxValue) * 100);

      return `
        <div class="analytics-row">
          <div class="analytics-row-label">
            <span>${escapeHTML(label)}</span>
            <strong>${count}</strong>
          </div>

          <div class="analytics-track">
            <div class="analytics-fill" style="width:${width}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

/* =========================
   REPORT FILTERS
========================= */

function getReportComplaints() {
  const startValue =
    document.getElementById("reportStartDate")?.value || "";

  const endValue =
    document.getElementById("reportEndDate")?.value || "";

  const status =
    document.getElementById("reportStatus")?.value || "All";

  const category =
    document.getElementById("reportCategory")?.value || "All";

  if (startValue && endValue && startValue > endValue) {
    showToast("The start date must be before the end date.", "error");
    return null;
  }

  const start = startValue
    ? new Date(`${startValue}T00:00:00`)
    : null;

  const end = endValue
    ? new Date(`${endValue}T23:59:59.999`)
    : null;

  return allComplaints.filter(({ data }) => {
    const created = data.createdAt?.toDate
      ? data.createdAt.toDate()
      : null;

    if (start && (!created || created < start)) return false;
    if (end && (!created || created > end)) return false;
    if (status !== "All" && data.status !== status) return false;
    if (category !== "All" && data.category !== category) return false;

    return true;
  });
}

function updateReportSummary() {
  const summary = document.getElementById("reportSummary");
  if (!summary) return;

  const filtered = getReportComplaints();
  if (!filtered) return;

  const resolved = filtered.filter(
    ({ data }) => data.status === "Resolved"
  ).length;

  summary.textContent =
    `${filtered.length} complaint(s) match the selected filters; ` +
    `${resolved} resolved.`;
}

/* =========================
   CSV EXPORT
========================= */

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportReportCSV() {
  const filtered = getReportComplaints();
  if (!filtered) return;

  if (!filtered.length) {
    showToast("There are no complaints to export.", "info");
    return;
  }

  const headers = [
    "Complaint ID",
    "Title",
    "Category",
    "Priority",
    "Status",
    "User Email",
    "Assigned Staff",
    "Department",
    "Due Date",
    "Submitted At",
    "Description",
  ];

  const rows = filtered.map(({ id, data }) => [
    id,
    data.title,
    data.category,
    data.priority,
    data.status,
    data.userEmail,
    data.assignedTo,
    data.assignedDepartment,
    data.dueDate,
    data.createdAt?.toDate
      ? data.createdAt.toDate().toLocaleString()
      : "",
    data.description,
  ]);

  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download =
    `complainify-report-${new Date().toISOString().slice(0, 10)}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  showToast("CSV report exported.", "success");
}

/* =========================
   REPORT EVENT LISTENERS
========================= */

function bindIfPresent(id, eventName, handler) {
  document.getElementById(id)?.addEventListener(eventName, handler);
}

[
  "reportStartDate",
  "reportEndDate",
  "reportStatus",
  "reportCategory",
].forEach((id) => {
  bindIfPresent(id, "change", updateReportSummary);
});

bindIfPresent("exportReportBtn", "click", exportReportCSV);

bindIfPresent("printReportBtn", "click", () => {
  window.print();
});

bindIfPresent("resetReportBtn", "click", () => {
  const start = document.getElementById("reportStartDate");
  const end = document.getElementById("reportEndDate");
  const status = document.getElementById("reportStatus");
  const category = document.getElementById("reportCategory");

  if (start) start.value = "";
  if (end) end.value = "";
  if (status) status.value = "All";
  if (category) category.value = "All";

  updateReportSummary();
});