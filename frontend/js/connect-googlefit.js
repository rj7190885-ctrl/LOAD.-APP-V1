/* ========================================
   LOAD App - Connect Google Fit Script
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    const proceedBtn = document.getElementById('proceed-btn');
    const skipBtn = document.getElementById('skip-btn');
    const screen = document.querySelector('.connect-screen');

    function slideOut(destination) {
        screen.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0, 1)';
        screen.style.opacity = '0';
        screen.style.transform = 'translateX(-60px)';

        setTimeout(() => {
            window.location.href = destination;
        }, 500);
    }

    // Proceed button — go to Allow Access slide
    proceedBtn.addEventListener('click', (e) => {
        // Ripple effect
        const ripple = document.createElement('span');
        const rect = proceedBtn.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.1);
            width: 120px;
            height: 120px;
            left: ${x}px;
            top: ${y}px;
            transform: translate(-50%, -50%) scale(0);
            animation: ripple 0.5s ease-out forwards;
            pointer-events: none;
        `;

        proceedBtn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);

        // Navigate to Allow Access slide after ripple
        setTimeout(() => slideOut('allow-access.html'), 300);
    });

    // Skip button — skip Allow Access slide entirely, go to profile setup
    skipBtn.addEventListener('click', () => {
        screen.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0, 1)';
        screen.style.opacity = '0';
        screen.style.transform = 'translateX(-60px)';

        setTimeout(() => {
            window.location.href = 'profile-gender.html';
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
