const TOAST_DURATION = 4200;

export function showToast(message, type = "info", duration = TOAST_DURATION) {
    let container = document.getElementById("toastContainer");

    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container";
        container.setAttribute("aria-live", "polite");
        container.setAttribute("aria-atomic", "false");
        document.body.appendChild(container);
    }

    const allowedTypes = ["success", "error", "warning", "info"];
    const toastType = allowedTypes.includes(type) ? type : "info";
    const toast = document.createElement("div");
    toast.className = `toast toast-${toastType}`;
    toast.setAttribute("role", toastType === "error" ? "alert" : "status");

    const iconMap = {
        success: "✓",
        error: "!",
        warning: "⚠",
        info: "i"
    };

    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = iconMap[toastType];

    const text = document.createElement("span");
    text.className = "toast-message";
    text.textContent = String(message);

    const closeButton = document.createElement("button");
    closeButton.className = "toast-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Dismiss notification");
    closeButton.textContent = "×";

    let timeoutId;
    const dismiss = () => {
        if (timeoutId) window.clearTimeout(timeoutId);
        toast.classList.add("toast-exit");
        toast.addEventListener("animationend", () => toast.remove(), { once: true });
        window.setTimeout(() => toast.remove(), 250);
    };

    closeButton.addEventListener("click", dismiss);
    toast.append(icon, text, closeButton);
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("toast-visible"));

    if (duration > 0) timeoutId = window.setTimeout(dismiss, duration);

    return { dismiss, element: toast };
}
