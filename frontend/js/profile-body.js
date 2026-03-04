/* ========================================
   LOAD App - Weight & Height Script
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    const weightInput = document.getElementById('weight-input');
    const heightInput = document.getElementById('height-input');
    const continueBtn = document.getElementById('continue-btn');
    const backBtn = document.getElementById('back-btn');
    const screen = document.querySelector('.profile-screen');

    function validateInputs() {
        const w = parseFloat(weightInput.value);
        const h = parseFloat(heightInput.value);
        const valid = w > 0 && w <= 300 && h > 0 && h <= 300;
        continueBtn.disabled = !valid;
    }

    weightInput.addEventListener('input', validateInputs);
    heightInput.addEventListener('input', validateInputs);

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

    // Continue → Username & Mobile
    continueBtn.addEventListener('click', (e) => {
        if (continueBtn.disabled) return;

        // Save values
        localStorage.setItem('load_weight', weightInput.value);
        localStorage.setItem('load_height', heightInput.value);

        const ripple = document.createElement('span');
        const rect = continueBtn.getBoundingClientRect();
        ripple.style.cssText = `
            position: absolute; border-radius: 50%;
            background: rgba(0,0,0,0.1); width: 120px; height: 120px;
            left: ${e.clientX - rect.left}px; top: ${e.clientY - rect.top}px;
            transform: translate(-50%,-50%) scale(0);
            animation: ripple 0.5s ease-out forwards; pointer-events: none;
        `;
        continueBtn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);
        setTimeout(() => slideOut('profile-contact.html'), 300);
    });

    // Back → Gender
    backBtn.addEventListener('click', () => {
        slideBack('profile-gender.html');
    });

    // Ripple keyframe
    const style = document.createElement('style');
    style.textContent = `@keyframes ripple { to { transform: translate(-50%,-50%) scale(4); opacity: 0; } }`;
    document.head.appendChild(style);

    // Restore saved values
    const savedW = localStorage.getItem('load_weight');
    const savedH = localStorage.getItem('load_height');
    if (savedW) weightInput.value = savedW;
    if (savedH) heightInput.value = savedH;
    validateInputs();
});
