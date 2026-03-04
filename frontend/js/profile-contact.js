/* ========================================
   LOAD App - Username & Mobile Script
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('username-input');
    const mobileInput = document.getElementById('mobile-input');
    const finishBtn = document.getElementById('finish-btn');
    const backBtn = document.getElementById('back-btn');
    const screen = document.querySelector('.profile-screen');

    function validateInputs() {
        const username = usernameInput.value.trim();
        // Username is required, mobile is optional
        finishBtn.disabled = username.length < 2;
    }

    usernameInput.addEventListener('input', validateInputs);
    mobileInput.addEventListener('input', validateInputs);

    function slideOut(destination) {
        screen.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0, 1)';
        screen.style.opacity = '0';
        screen.style.transform = 'translateX(-60px)';
        setTimeout(() => { window.location.href = destination; }, 500);
    }

    function slideBack(destination) {
        screen.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0, 1)';
        screen.style.opacity = '0';
        screen.style.transform = 'translateX(60px)';
        setTimeout(() => { window.location.href = destination; }, 500);
    }

    // Finish → Save all data and navigate to dashboard / next screen
    finishBtn.addEventListener('click', (e) => {
        if (finishBtn.disabled) return;

        // Save values
        localStorage.setItem('load_username', usernameInput.value.trim());
        if (mobileInput.value.trim()) {
            localStorage.setItem('load_mobile', mobileInput.value.trim());
        }

        // Green success feedback
        finishBtn.style.background = '#34A853';
        finishBtn.style.color = '#ffffff';
        finishBtn.innerHTML = `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6L9 17l-5-5" />
            </svg>
            All Set!
        `;

        const ripple = document.createElement('span');
        const rect = finishBtn.getBoundingClientRect();
        ripple.style.cssText = `
            position: absolute; border-radius: 50%;
            background: rgba(52,168,83,0.15); width: 120px; height: 120px;
            left: ${e.clientX - rect.left}px; top: ${e.clientY - rect.top}px;
            transform: translate(-50%,-50%) scale(0);
            animation: ripple 0.5s ease-out forwards; pointer-events: none;
        `;
        finishBtn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);

        // Navigate after success feedback
        setTimeout(() => {
            screen.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0, 1)';
            screen.style.opacity = '0';
            screen.style.transform = 'translateX(-60px)';

            setTimeout(() => {
                console.log('Profile setup complete! Navigating to dashboard.');
                window.location.href = 'dashboard.html';
            }, 500);
        }, 800);
    });

    // Back → Weight & Height
    backBtn.addEventListener('click', () => {
        slideBack('profile-body.html');
    });

    // Ripple keyframe
    const style = document.createElement('style');
    style.textContent = `@keyframes ripple { to { transform: translate(-50%,-50%) scale(4); opacity: 0; } }`;
    document.head.appendChild(style);

    // Restore saved values
    const savedU = localStorage.getItem('load_username');
    const savedM = localStorage.getItem('load_mobile');
    if (savedU) usernameInput.value = savedU;
    if (savedM) mobileInput.value = savedM;
    validateInputs();
});
