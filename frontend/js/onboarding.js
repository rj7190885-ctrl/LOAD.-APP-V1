/* ========================================
   LOAD App - Get Started Screen Script
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ---- Handle Google Auth Redirect Flow ----
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userStr = urlParams.get('user');

    if (token && userStr) {
        // Save the session details securely to localStorage
        localStorage.setItem('load_token', token);
        localStorage.setItem('load_user', userStr);

        // Clean the URL so the token doesn't stay visible in the address bar
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    // ------------------------------------------

    const btn = document.getElementById('get-started-btn');

    btn.addEventListener('click', (e) => {
        // Ripple effect
        const ripple = document.createElement('span');
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.12);
            width: 120px;
            height: 120px;
            left: ${x}px;
            top: ${y}px;
            transform: translate(-50%, -50%) scale(0);
            animation: ripple 0.5s ease-out forwards;
            pointer-events: none;
        `;

        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);

        // Slide the screen out to the left before navigating
        const screen = document.querySelector('.onboarding-screen');
        screen.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0, 1)';
        screen.style.opacity = '0';
        screen.style.transform = 'translateX(-60px)';

        // Navigate to Google Fit connect screen
        setTimeout(() => {
            window.location.href = 'connect-googlefit.html';
        }, 500);
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
