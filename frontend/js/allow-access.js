/* ========================================
   LOAD App - Allow Access Script
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    const allowBtn = document.getElementById('allow-btn');
    const denyBtn = document.getElementById('deny-btn');
    const screen = document.querySelector('.access-screen');

    function navigateNext() {
        // Slide out to left
        screen.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0, 1)';
        screen.style.opacity = '0';
        screen.style.transform = 'translateX(-60px)';

        setTimeout(() => {
            window.location.href = 'profile-gender.html';
        }, 500);
    }

    // Helper to get JWT token from URL params (from previous login step) or local storage
    function getAuthToken() {
        const urlParams = new URLSearchParams(window.location.search);
        let token = urlParams.get('token');
        if (!token) {
            token = localStorage.getItem('load_token');
        } else {
            // Save it for future use
            localStorage.setItem('load_token', token);
        }
        return token;
    }

    // Allow Access button — grant permission then navigate
    allowBtn.addEventListener('click', async (e) => {
        // Ripple effect
        const ripple = document.createElement('span');
        const rect = allowBtn.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(52, 168, 83, 0.15);
            width: 120px;
            height: 120px;
            left: ${x}px;
            top: ${y}px;
            transform: translate(-50%, -50%) scale(0);
            animation: ripple 0.5s ease-out forwards;
            pointer-events: none;
        `;

        allowBtn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);

        try {
            allowBtn.innerText = 'Connecting...';

            const token = getAuthToken();
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // In local development, the API runs on port 5000. In prod, it's relative or to a Vercel URL.
            // Adjust base URL as needed based on environment.
            const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:5000'
                : 'https://load-backend-k7na.onrender.com'; // Change to absolute URL of backend

            const response = await fetch(`${API_BASE}/api/fit/auth-url`, { headers });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Failed to get auth URL:", errorData);
                alert((errorData.error && errorData.error.message) || errorData.error || "Failed to initialize Google Fit connection. Please try again.");
                allowBtn.innerText = 'Allow Access';
                return;
            }

            const data = await response.json();
            if (data && data.url) {
                // Redirect user to Google OAuth screen
                window.location.href = data.url;
            }

        } catch (err) {
            console.error("Error triggering OAuth:", err);
            allowBtn.innerText = 'Allow Access';
            alert("Network error occurred. Ensure the backend server is running.");
        }
    });

    // Deny button — skip
    denyBtn.addEventListener('click', () => {
        navigateNext();
    });

    // Inject ripple keyframe
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: translate(-50%, -50%) scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});
