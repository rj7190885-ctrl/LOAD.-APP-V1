/* ========================================
   LOAD App - Gender Selection Script
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.gender-card');
    const continueBtn = document.getElementById('continue-btn');
    const backBtn = document.getElementById('back-btn');
    const screen = document.querySelector('.profile-screen');
    let selectedGender = null;

    // Gender card selection
    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedGender = card.dataset.gender;
            continueBtn.disabled = false;

            // Store selection
            localStorage.setItem('load_gender', selectedGender);
        });
    });

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

    // Continue → Weight & Height
    continueBtn.addEventListener('click', (e) => {
        if (!selectedGender) return;

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
        setTimeout(() => slideOut('profile-body.html'), 300);
    });

    // Back → Allow Access
    backBtn.addEventListener('click', () => {
        slideBack('allow-access.html');
    });

    // Ripple keyframe
    const style = document.createElement('style');
    style.textContent = `@keyframes ripple { to { transform: translate(-50%,-50%) scale(4); opacity: 0; } }`;
    document.head.appendChild(style);

    // Restore previous selection
    const saved = localStorage.getItem('load_gender');
    if (saved) {
        const card = document.querySelector(`[data-gender="${saved}"]`);
        if (card) {
            card.classList.add('selected');
            selectedGender = saved;
            continueBtn.disabled = false;
        }
    }
});
