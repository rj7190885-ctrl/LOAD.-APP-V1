/* ========================================
   LOAD App - Login Page Script
   Splash Animation + Liquid Glass Tilt
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    const splashScreen = document.getElementById('splash-screen');
    const splashLogo = document.querySelector('.splash-logo');
    const card = document.querySelector('.glass-card');
    const container = document.querySelector('.login-container');

    /* ----------------------------------------
       SPLASH ANIMATION SEQUENCE
       Timeline (all durations in ms):
       0ms      — Page loads
       300ms    — "LOAD" text fades in (1200ms duration)
       1000ms   — Red dot pops in (800ms duration)
       2400ms   — Logo slides left smoothly (1400ms duration)
       3200ms   — Splash fades out (800ms transition)
       3400ms   — Login card revealed with staggered elements
       ---------------------------------------- */

    // Phase 3: After text + dot have appeared, slide the logo left
    setTimeout(() => {
        splashLogo.classList.add('slide-away');
    }, 2400);

    // Phase 4: Fade out the splash overlay
    setTimeout(() => {
        splashScreen.classList.add('fade-out');
    }, 3200);

    // Phase 5: Reveal the login container
    setTimeout(() => {
        container.classList.add('revealed');
    }, 3400);

    // Phase 6: Remove splash from DOM after all transitions complete
    setTimeout(() => {
        splashScreen.remove();
    }, 4200);


    /* ----------------------------------------
       LIQUID GLASS TILT EFFECT
       ---------------------------------------- */
    container.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const deltaX = (e.clientX - centerX) / (rect.width / 2);
        const deltaY = (e.clientY - centerY) / (rect.height / 2);

        const rotateX = deltaY * -3;
        const rotateY = deltaX * 3;

        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    container.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
    });


    /* ----------------------------------------
       GOOGLE SIGN-IN CALLBACK
       ---------------------------------------- */
    window.handleGoogleLogin = async function (response) {
        if (!response || !response.credential) {
            console.error('Google Sign-In failed or missing credential');
            return;
        }

        try {
            // Send the ID token to our backend
            const res = await fetch('http://localhost:5000/api/auth/google', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ credential: response.credential })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            // Save token and user data to localStorage
            localStorage.setItem('load_token', data.token);
            localStorage.setItem('load_user', JSON.stringify(data.user));

            // Transition out and navigate to onboarding
            const loginContainer = document.querySelector('.login-container');
            if (loginContainer) {
                loginContainer.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0, 1)';
                loginContainer.style.opacity = '0';
                loginContainer.style.transform = 'translateX(-60px)';
            }

            setTimeout(() => {
                window.location.href = 'pages/onboarding.html';
            }, 500);

        } catch (error) {
            console.error('Login error:', error);
            alert('Failed to login. Please ensure the backend is running and you have a valid Google Client ID.');
        }
    };

    // Inject ripple keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes rippleAnim {
            to {
                transform: translate(-50%, -50%) scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});
