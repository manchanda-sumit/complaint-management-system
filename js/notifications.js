
import { auth } from "./firebase.js";
import { db } from "./firebase.js";

import {
    collection,
    query,
    where,
    limit,
    onSnapshot,
    doc,
    updateDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const MAX_NOTIFICATIONS = 50;

let stopListening = null;
let notifications = [];
let panelOpen = false;

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function formatDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") {
        return "Just now";
    }

    return timestamp.toDate().toLocaleString();
}

function ensureNotificationUI() {
    let container = document.getElementById("notificationCenter");

    if (container) return container;

    const nav = document.querySelector(".nav-buttons");

    if (!nav) {
        console.warn("Notification centre: navbar not found.");
        return null;
    }

    container = document.createElement("div");
    container.id = "notificationCenter";
    container.className = "notification-center";

    container.innerHTML = `
        <button
            type="button"
            class="notification-bell"
            id="notificationBell"
            aria-label="Notifications"
            aria-expanded="false"
            aria-controls="notificationPanel"
        >
            <span aria-hidden="true">🔔</span>
            <span class="notification-count" id="notificationCount"
                  hidden>0</span>
        </button>

        <section
            class="notification-panel"
            id="notificationPanel"
            aria-label="Notifications"
            hidden
        >
            <div class="notification-panel-header">
                <div>
                    <h3>Notifications</h3>
                    <p id="notificationSummary">Your latest updates</p>
                </div>

                <button
                    type="button"
                    class="notification-text-button"
                    id="markAllNotificationsRead"
                >
                    Mark all read
                </button>
            </div>

            <div
                class="notification-list"
                id="notificationList"
                aria-live="polite"
            >
                <p class="notification-empty">Loading notifications...</p>
            </div>
        </section>
    `;

    nav.prepend(container);

    const bell = container.querySelector("#notificationBell");
    const panel = container.querySelector("#notificationPanel");
    const markAllButton = container.querySelector(
        "#markAllNotificationsRead"
    );

    bell.addEventListener("click", () => {
        panelOpen = !panelOpen;
        panel.hidden = !panelOpen;
        bell.setAttribute("aria-expanded", String(panelOpen));
    });

    markAllButton.addEventListener("click", markAllAsRead);

    document.addEventListener("click", (event) => {
        if (!container.contains(event.target)) {
            panelOpen = false;
            panel.hidden = true;
            bell.setAttribute("aria-expanded", "false");
        }
    });

    return container;
}

function renderNotifications() {
    const container = ensureNotificationUI();
    if (!container) return;

    const countElement = container.querySelector("#notificationCount");
    const summary = container.querySelector("#notificationSummary");
    const list = container.querySelector("#notificationList");

    const unreadCount = notifications.filter(
        (notification) => notification.read !== true
    ).length;

    countElement.textContent =
        unreadCount > 99 ? "99+" : String(unreadCount);

    countElement.hidden = unreadCount === 0;

    summary.textContent = unreadCount === 1
        ? "1 unread notification"
        : `${unreadCount} unread notifications`;

    if (notifications.length === 0) {
        list.innerHTML = `
            <div class="notification-empty">
                <span aria-hidden="true">📭</span>
                <p>You're all caught up!</p>
                <small>New complaint updates will appear here.</small>
            </div>
        `;
        return;
    }

    list.innerHTML = notifications.map((notification) => {
        const unread = notification.read !== true;

        return `
            <article class="notification-item ${unread ? "unread" : ""}">
                <div class="notification-item-content">
                    <strong>${escapeHTML(notification.title || "Update")}</strong>
                    <p>${escapeHTML(notification.message || "")}</p>
                    <small>${escapeHTML(formatDate(notification.createdAt))}</small>
                </div>

                ${
                    unread
                        ? `<button
                               type="button"
                               class="notification-read-button"
                               data-notification-id="${escapeHTML(notification.id)}"
                           >Mark read</button>`
                        : `<span class="notification-read-label">Read</span>`
                }
            </article>
        `;
    }).join("");

    list.querySelectorAll("[data-notification-id]").forEach((button) => {
        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                await updateDoc(
                    doc(db, "notifications", button.dataset.notificationId),
                    { read: true }
                );
            } catch (error) {
                console.error("Could not mark notification as read:", error);
                button.disabled = false;
            }
        });
    });
}

async function markAllAsRead() {
    const unread = notifications.filter(
        (notification) => notification.read !== true
    );

    if (unread.length === 0) return;

    const button = document.getElementById("markAllNotificationsRead");
    if (button) button.disabled = true;

    try {
        // Firestore batches support at most 500 operations.
        // Our notification query is limited to 50.
        const batch = writeBatch(db);

        unread.forEach((notification) => {
            batch.update(
                doc(db, "notifications", notification.id),
                { read: true }
            );
        });

        await batch.commit();
    } catch (error) {
        console.error("Could not mark notifications as read:", error);
    } finally {
        if (button) button.disabled = false;
    }
}

function startListening(user) {
    if (stopListening) {
        stopListening();
        stopListening = null;
    }

    notifications = [];
    renderNotifications();

    const notificationsQuery = query(
        collection(db, "notifications"),
        where("recipientId", "==", user.uid),
        limit(MAX_NOTIFICATIONS)
    );

    stopListening = onSnapshot(
        notificationsQuery,
        (snapshot) => {
            notifications = snapshot.docs.map((item) => ({
                id: item.id,
                ...item.data()
            }));

            notifications.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });

            renderNotifications();
        },
        (error) => {
            console.error("Notification listener failed:", error);

            const list = document.getElementById("notificationList");

            if (list) {
                list.innerHTML = `
                    <p class="notification-empty">
                        Notifications couldn't be loaded.
                        Please refresh and try again.
                    </p>
                `;
            }
        }
    );
}

ensureNotificationUI();

onAuthStateChangedSafe();

async function onAuthStateChangedSafe() {
    // Import the auth listener separately to keep auth handling explicit.
    const { onAuthStateChanged } = await import(
        "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js"
    );

    onAuthStateChanged(auth, (user) => {
        if (stopListening) {
            stopListening();
            stopListening = null;
        }

        notifications = [];

        if (user) {
            ensureNotificationUI();
            startListening(user);
        } else {
            const container =
                document.getElementById("notificationCenter");

            if (container) container.remove();
        }
    });
}
