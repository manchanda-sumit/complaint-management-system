
const THEME_KEY = "complainify-theme";

function applyTheme(theme) {
    const selectedTheme = theme === "light" ? "light" : "dark";

    document.documentElement.dataset.theme = selectedTheme;

    const toggle = document.getElementById("themeToggle");

    if (toggle) {
        toggle.textContent = selectedTheme === "dark" ? "☀️ Light mode" : "🌙 Dark mode";
        toggle.setAttribute(
            "aria-label",
            selectedTheme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
        );
        toggle.setAttribute("aria-pressed", String(selectedTheme === "light"));
    }
}

let savedTheme = "dark";

try {
    savedTheme = localStorage.getItem(THEME_KEY) || "dark";
} catch (error) {
    console.warn("Theme preference could not be read.", error);
}

applyTheme(savedTheme);

document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("themeToggle");

    if (!toggle) return;

    toggle.addEventListener("click", () => {
        const nextTheme =
            document.documentElement.dataset.theme === "dark"
                ? "light"
                : "dark";

        applyTheme(nextTheme);

        try {
            localStorage.setItem(THEME_KEY, nextTheme);
        } catch (error) {
            console.warn("Theme preference could not be saved.", error);
        }
    });
});
