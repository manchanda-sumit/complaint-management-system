import { auth, db } from "./firebase.js";
import { showToast } from "./toast.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";


/* =========================
   REGISTER
========================= */

const registerForm = document.getElementById("registerForm");

if (registerForm) {

    registerForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const message = document.getElementById("registerMessage");

        try {

            message.textContent = "Creating account...";

            const userCredential =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            const user = userCredential.user;


            await setDoc(doc(db, "users", user.uid), {

                name: name,

                email: email,

                role: "user",

                createdAt: serverTimestamp()

            });


            message.textContent =
                "Account created successfully! Redirecting...";
            showToast("Account created successfully. Welcome to Complainify!", "success");

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1000);


        } catch (error) {

            console.error(error);

            const friendlyMessage = getErrorMessage(error.code);
            message.textContent = friendlyMessage;
            showToast(friendlyMessage, "error");

        }

    });

}


/* =========================
   LOGIN
========================= */

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value;

        const message =
            document.getElementById("loginMessage");


        try {

            message.textContent = "Logging in...";


            const userCredential =
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


            const user = userCredential.user;


            const userDoc =
                await getDoc(doc(db, "users", user.uid));


            if (userDoc.exists()) {

                const userData = userDoc.data();


                if (userData.role === "admin") {

                    showToast("Login successful. Welcome back!", "success");
                    setTimeout(() => {
                        window.location.href = "admin.html";
                    }, 650);

                } else {

                    showToast("Login successful. Welcome back!", "success");
                    setTimeout(() => {
                        window.location.href = "dashboard.html";
                    }, 650);

                }

            } else {

                showToast("Login successful. Welcome back!", "success");
                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 650);

            }


        } catch (error) {

            console.error(error);

            const friendlyMessage = getErrorMessage(error.code);
            message.textContent = friendlyMessage;
            showToast(friendlyMessage, "error");

        }

    });

}


/* =========================
   ERROR MESSAGES
========================= */

function getErrorMessage(code) {

    switch (code) {

        case "auth/email-already-in-use":
            return "This email is already registered.";

        case "auth/invalid-email":
            return "Please enter a valid email.";

        case "auth/weak-password":
            return "Password must be at least 6 characters.";

        case "auth/invalid-credential":
            return "Invalid email or password.";

        case "permission-denied":
            return "Firestore permission denied. Check Firebase Security Rules.";

        default:
            return `Something went wrong: ${code}`;
    }
}


/* =========================
   FORGOT PASSWORD
========================= */

const forgotPasswordForm =
    document.getElementById("forgotPasswordForm");

if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email =
            document.getElementById("resetEmail").value.trim();

        const message =
            document.getElementById("resetMessage");

        const button =
            document.getElementById("resetPasswordButton");

        try {
            button.disabled = true;
            button.textContent = "Sending...";
            message.textContent = "";

            await sendPasswordResetEmail(auth, email);

            message.textContent =
                "If an account exists for this email, a password reset " +
                "email will be sent. Check your inbox and spam folder.";

            forgotPasswordForm.reset();

        } catch (error) {
            console.error("Password reset error:", error);

            if (
                error.code === "auth/invalid-email" ||
                error.code === "auth/missing-email"
            ) {
                message.textContent =
                    "Please enter a valid email address.";
            } else if (
                error.code === "auth/too-many-requests"
            ) {
                message.textContent =
                    "Too many attempts. Please wait before trying again.";
            } else {
                message.textContent =
                    "We couldn't process your request. Please try again later.";
            }
        } finally {
            button.disabled = false;
            button.textContent = "Send Reset Link";
        }
    });
}
