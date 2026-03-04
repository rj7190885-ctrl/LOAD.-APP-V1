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

    // Allow Access button — grant permission then navigate
    allowBtn.addEventListener('click', (e) => {
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

        // Brief success feedback
        allowBtn.style.background = '#34A853';
        allowBtn.style.color = '#ffffff';
        allowBtn.innerHTML = `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6L9 17l-5-5" />
            </svg>
            Connected
        `;

        // Navigate after visual feedback
        setTimeout(navigateNext, 800);
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
