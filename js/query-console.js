import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  collection, query, where, orderBy, limit, getDocs, doc, getDoc,
  updateDoc, deleteDoc, addDoc, serverTimestamp, writeBatch, runTransaction
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/*
 * Complainify Firestore Query Console
 * DevTools Console commands are JavaScript wrappers around real Firestore operations.
 * Firestore is NoSQL: this is not a SQL shell and does not execute SQL syntax.
 */
let signedInUser = null;
let roleVerified = false;
let authReadyResolve;
const authReady = new Promise(resolve => { authReadyResolve = resolve; });
onAuthStateChanged(auth, async (user) => {
  signedInUser = user;
  roleVerified = false;
  if (user) {
    try {
      const profile = await getDoc(doc(db, "users", user.uid));
      roleVerified = profile.exists() && profile.data().role === "admin";
    } catch (e) {
      console.error("Query console role check failed:", e);
    }
  }
  authReadyResolve();
});

async function requireAdmin() {
  await authReady;
  if (!signedInUser) throw new Error("Sign in first. Open admin.html and log in as an administrator.");
  if (!roleVerified) throw new Error("Administrator role could not be verified. Query operations blocked.");
}
function safeFilter(q, filters = {}) {
  const validFields = new Set(["status", "priority", "category", "userId", "userEmail", "assignedTo", "assignedDepartment"]);
  for (const [field, value] of Object.entries(filters || {})) {
    if (!validFields.has(field)) throw new Error(`Unsupported filter field: ${field}. Allowed: ${[...validFields].join(", ")}`);
    if (value !== undefined && value !== null && value !== "") q = query(q, where(field, "==", value));
  }
  return q;
}
const writableFields = new Set(["title", "category", "priority", "description", "status", "assignedTo", "assignedDepartment", "dueDate", "adminRemarks"]);
function validateChanges(changes) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes) || Object.keys(changes).length === 0) {
    throw new Error("Provide a non-empty changes object.");
  }
  const invalid = Object.keys(changes).filter(k => !writableFields.has(k));
  if (invalid.length) throw new Error("Unsupported fields: " + invalid.join(", "));
  return { ...changes, updatedAt: serverTimestamp() };
}
function refreshWebsite() {
  // admin.js listens for this event and reloads Firestore records and statistics.
  window.dispatchEvent(new CustomEvent("complainify:firestore-mutated"));
}
function printHelp() {
  const commands = [
    'await complainifyQuery.help()',
    'await complainifyQuery.verify()',
    'await complainifyQuery.select({})',
    'await complainifyQuery.select({ status: "Pending" })',
    'await complainifyQuery.select({ priority: "High" })',
    'await complainifyQuery.select({ status: "Pending", priority: "Low" })',
    'await complainifyQuery.get("DOCUMENT_ID")',
    'await complainifyQuery.count({ status: "Resolved" })',
    'await complainifyQuery.statusSummary()',
    'await complainifyQuery.insert({ title: "QC TEST - create", category: "Other", priority: "Low", description: "Temporary query-console test; safe to delete." })',
    'await complainifyQuery.update("DOCUMENT_ID", { status: "In Progress" })',
    'await complainifyQuery.transactionUpdate("DOCUMENT_ID", { status: "Resolved" })',
    'await complainifyQuery.batchUpdate(["ID_1", "ID_2"], { priority: "Medium" })',
    'await complainifyQuery.delete("DOCUMENT_ID")'
  ];
  console.log("Complainify Firestore Query Console — JavaScript, not SQL");
  console.log("\nREAD / QUERY\n" + commands.slice(1, 9).join("\n"));
  console.log("\nCREATE / UPDATE / DELETE\n" + commands.slice(9).join("\n"));
  console.log("\nUse actual IDs from get()/select() output. Delete only labelled demo records.");
  console.log("DDL/DCL/TCL note: Firestore has no SQL DDL/DCL/TCL commands. See FIREBASE-QUERY-CONSOLE.md for the closest equivalents and limitations.");
  return commands;
}

window.complainifyQuery = Object.freeze({
  help() { return printHelp(); },

  async verify() {
    await requireAdmin();
    const [userProfile, complaintSnapshot] = await Promise.all([
      getDoc(doc(db, "users", signedInUser.uid)),
      getDocs(query(collection(db, "complaints"), limit(1)))
    ]);
    const result = {
      signedIn: Boolean(signedInUser),
      email: signedInUser.email || "(no email)",
      adminRole: userProfile.exists() && userProfile.data().role === "admin",
      firestoreProject: "complaint-management-sys-e7464",
      complaintsCollectionReadable: true,
      atLeastOneComplaint: !complaintSnapshot.empty
    };
    console.table(result);
    console.log("Verified: this page successfully read the configured Cloud Firestore project.");
    return result;
  },

  async select(filters = {}, maxResults = 50) {
    await requireAdmin();
    const allowed = Math.max(1, Math.min(Number(maxResults) || 50, 100));
    let q = safeFilter(collection(db, "complaints"), filters);
    q = query(q, orderBy("createdAt", "desc"), limit(allowed));
    const snapshot = await getDocs(q);
    const rows = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    console.table(rows.map(r => ({ id:r.id, title:r.title, status:r.status, priority:r.priority, category:r.category, userEmail:r.userEmail })));
    console.log(`Returned ${rows.length} complaint(s) from Cloud Firestore.`);
    return rows;
  },

  async get(id) {
    await requireAdmin();
    if (!id || id === "DOCUMENT_ID") throw new Error("Replace DOCUMENT_ID with an actual document ID from select().");
    const snapshot = await getDoc(doc(db, "complaints", id));
    if (!snapshot.exists()) { console.warn("No complaint found for ID:", id); return null; }
    const result = { id: snapshot.id, ...snapshot.data() };
    console.log("Document read from Cloud Firestore:");
    console.table([result]);
    return result;
  },

  async count(filters = {}) {
    await requireAdmin();
    const snapshot = await getDocs(safeFilter(collection(db, "complaints"), filters));
    console.log(`Matching complaints: ${snapshot.size}`);
    return snapshot.size;
  },

  async statusSummary() {
    await requireAdmin();
    const snapshot = await getDocs(collection(db, "complaints"));
    const summary = { total: snapshot.size, Pending: 0, "In Progress": 0, Resolved: 0, Other: 0 };
    for (const item of snapshot.docs) {
      const status = item.data().status || "Other";
      if (Object.hasOwn(summary, status) && status !== "total") summary[status]++;
      else summary.Other++;
    }
    console.table(summary);
    console.log("Compare these totals with the admin dashboard cards.");
    return summary;
  },

  async insert(data) {
    await requireAdmin();
    if (!data || !String(data.title || "").trim() || !String(data.description || "").trim()) throw new Error("Provide a title and description.");
    const priority = data.priority || "Low";
    const category = data.category || "Other";
    const allowedPriorities = ["High", "Medium", "Low"];
    const allowedCategories = ["Academic", "Infrastructure", "IT / Technical", "Administration", "Facilities", "Other"];
    if (!allowedPriorities.includes(priority) || !allowedCategories.includes(category)) throw new Error("Use a valid priority and category.");
    const payload = {
      title: String(data.title).trim(), description: String(data.description).trim(),
      category, priority, status: "Pending", userId: signedInUser.uid,
      userEmail: signedInUser.email || "", assignedTo: "", assignedDepartment: "", dueDate: "",
      createdAt: serverTimestamp()
    };
    const ref = await addDoc(collection(db, "complaints"), payload);
    console.log("INSERT successful — created Firestore document:", ref.id);
    refreshWebsite();
    return { id: ref.id, created: true };
  },

  async update(id, changes) {
    await requireAdmin();
    if (!id || id === "DOCUMENT_ID") throw new Error("Replace DOCUMENT_ID with an actual document ID from select().");
    const payload = validateChanges(changes);
    await updateDoc(doc(db, "complaints", id), payload);
    console.log("UPDATE successful — Firestore document changed:", id, changes);
    refreshWebsite();
    return { id, updated: true };
  },

  async transactionUpdate(id, changes) {
    await requireAdmin();
    if (!id || id === "DOCUMENT_ID") throw new Error("Replace DOCUMENT_ID with an actual document ID from select().");
    const payload = validateChanges(changes);
    await runTransaction(db, async (transaction) => {
      const ref = doc(db, "complaints", id);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error(`No document to update: ${id}`);
      transaction.update(ref, payload);
    });
    console.log("TRANSACTION successful — atomic Firestore update committed:", id, changes);
    refreshWebsite();
    return { id, transactionCommitted: true };
  },

  async batchUpdate(ids, changes) {
    await requireAdmin();
    if (!Array.isArray(ids) || ids.length === 0) throw new Error("Provide an array of actual document IDs.");
    if (ids.length > 400) throw new Error("For this demo, batch updates are limited to 400 documents.");
    if (ids.some(id => !id || id === "DOCUMENT_ID" || id.startsWith("ID_"))) throw new Error("Replace every placeholder with an actual document ID.");
    const payload = validateChanges(changes);
    const batch = writeBatch(db);
    for (const id of ids) batch.update(doc(db, "complaints", id), payload);
    await batch.commit();
    console.log(`BATCH COMMIT successful — updated ${ids.length} Firestore document(s).`);
    refreshWebsite();
    return { ids, updated: ids.length, committed: true };
  },

  async delete(id) {
    await requireAdmin();
    if (!id || id === "DOCUMENT_ID") throw new Error("Replace DOCUMENT_ID with an actual document ID from select().");
    if (!window.confirm(`Permanently delete complaint ${id} from Cloud Firestore? This cannot be undone.`)) return { id, deleted: false, cancelled: true };
    await deleteDoc(doc(db, "complaints", id));
    console.log("DELETE successful — removed Firestore document:", id);
    refreshWebsite();
    return { id, deleted: true };
  }
});
console.info("Complainify query console loaded. Run await complainifyQuery.help() in DevTools Console.");
