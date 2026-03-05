/* ========================================
   LOAD App - Recovery Dashboard Engine
   Mock Data · 16 Metrics · Charts
   ======================================== */

(function () {
    'use strict';

    // ────────────────────────────────────
    //  CONFIG
    // ────────────────────────────────────
    const USER_AGE = 25;
    const MAX_HR = 220 - USER_AGE; // 195
    const ZONES = [
        { name: 'Zone 1', min: 0, max: 0.6 * MAX_HR },
        { name: 'Zone 2', min: 0.6 * MAX_HR, max: 0.7 * MAX_HR },
        { name: 'Zone 3', min: 0.7 * MAX_HR, max: 0.8 * MAX_HR },
        { name: 'Zone 4', min: 0.8 * MAX_HR, max: 0.9 * MAX_HR },
        { name: 'Zone 5', min: 0.9 * MAX_HR, max: MAX_HR },
    ];
    const ZONE_WEIGHTS = [0, 1, 2, 4, 8];

    // ────────────────────────────────────
    //  MOCK DATA GENERATOR
    // ────────────────────────────────────
    function generateDayData(dayOffset) {
        const date = new Date();
        date.setDate(date.getDate() - dayOffset);
        const dateStr = date.toISOString().slice(0, 10);

        const hr = [];
        const spo2 = [];
        const steps = [];

        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 5) {
                const t = `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
                const isSleep = h >= 0 && h < 7;
                const isActive = (h >= 7 && h < 8) || (h >= 17 && h < 18);
                const isRest = !isSleep && !isActive;

                // Heart Rate
                let baseHR;
                if (isSleep) baseHR = 56 + Math.random() * 8;
                else if (isActive) baseHR = 120 + Math.random() * 50;
                else baseHR = 68 + Math.random() * 18;
                baseHR += (dayOffset % 3 === 0 ? 4 : 0); // some days slightly elevated
                hr.push({ t, v: Math.round(baseHR) });

                // SpO2
                let baseSpo2 = 96 + Math.random() * 3;
                if (dayOffset === 1 && isSleep) baseSpo2 -= Math.random() * 5; // dip day
                spo2.push({ t, v: Math.min(100, Math.round(baseSpo2 * 10) / 10) });

                // Steps (per 5-min window)
                let stepCount = 0;
                if (isActive) stepCount = 150 + Math.floor(Math.random() * 200);
                else if (!isSleep) stepCount = Math.floor(Math.random() * 40);
                steps.push({ t, v: stepCount });
            }
        }

        return { date: dateStr, hr, spo2, steps };
    }

    function generate7Days() {
        const days = [];
        for (let i = 6; i >= 0; i--) days.push(generateDayData(i));
        return days;
    }

    // ────────────────────────────────────
    //  METRIC CALCULATIONS
    // ────────────────────────────────────

    // 1. Resting Heart Rate: lowest 30-min avg during 0:00-7:00
    function calcRestingHR(day) {
        const sleepHR = day.hr.filter(d => {
            const h = parseInt(d.t.slice(11, 13));
            return h >= 0 && h < 7;
        }).map(d => d.v);

        let minAvg = Infinity;
        const windowSize = 6; // 6 samples × 5 min = 30 min
        for (let i = 0; i <= sleepHR.length - windowSize; i++) {
            const window = sleepHR.slice(i, i + windowSize);
            const avg = window.reduce((a, b) => a + b, 0) / windowSize;
            if (avg < minAvg) minAvg = avg;
        }
        return Math.round(minAvg);
    }

    // 2. HR Zone time (minutes in each zone)
    function calcHRZones(day) {
        const zoneMinutes = [0, 0, 0, 0, 0];
        day.hr.forEach(d => {
            for (let i = ZONES.length - 1; i >= 0; i--) {
                if (d.v >= ZONES[i].min) { zoneMinutes[i] += 5; break; }
            }
        });
        return zoneMinutes;
    }

    // 3. Training Load Score (time-weighted HR zone score, 0-21 scale)
    function calcTrainingLoad(zoneMinutes) {
        let score = 0;
        zoneMinutes.forEach((mins, i) => { score += mins * ZONE_WEIGHTS[i]; });
        return Math.min(21, Math.round((score / 200) * 21 * 10) / 10);
    }

    // 4. Heart Rate Recovery (HR drop in first 5 min after peak active HR)
    function calcHRRecovery(day) {
        const activeHR = day.hr.filter(d => {
            const h = parseInt(d.t.slice(11, 13));
            return (h >= 7 && h < 8) || (h >= 17 && h < 18);
        });
        if (activeHR.length < 2) return 30;
        const peakIdx = activeHR.reduce((pi, d, i, arr) => d.v > arr[pi].v ? i : pi, 0);
        const peakHR = activeHR[peakIdx].v;
        const nextHR = activeHR[Math.min(peakIdx + 1, activeHR.length - 1)].v;
        return Math.max(0, peakHR - nextHR);
    }

    // 5. Stress Index (elevated HR without steps > 100 bpm, steps < 10)
    function calcStressIndex(day) {
        let stressMinutes = 0;
        const totalAwake = day.hr.filter(d => parseInt(d.t.slice(11, 13)) >= 7).length;
        for (let i = 0; i < day.hr.length; i++) {
            const h = parseInt(day.hr[i].t.slice(11, 13));
            if (h < 7) continue;
            if (day.hr[i].v > 100 && day.steps[i] && day.steps[i].v < 10) stressMinutes++;
        }
        return Math.min(100, Math.round((stressMinutes / Math.max(1, totalAwake)) * 100));
    }

    // 6. Oxygen Stability Score (penalize drops below 92%)
    function calcO2Stability(day) {
        const total = day.spo2.length;
        const dropCount = day.spo2.filter(d => d.v < 92).length;
        return Math.max(0, Math.round(100 - (dropCount / total) * 500));
    }

    // 7. Sleep Stability Proxy (stable HR + stable SpO2 during sleep)
    function calcSleepStability(day) {
        const sleepHR = day.hr.filter(d => parseInt(d.t.slice(11, 13)) < 7).map(d => d.v);
        const sleepSpo2 = day.spo2.filter(d => parseInt(d.t.slice(11, 13)) < 7).map(d => d.v);
        if (sleepHR.length < 2) return 50;

        const hrMean = sleepHR.reduce((a, b) => a + b, 0) / sleepHR.length;
        const hrVariance = sleepHR.reduce((sum, v) => sum + Math.pow(v - hrMean, 2), 0) / sleepHR.length;
        const hrStability = Math.max(0, 100 - hrVariance * 2);

        const spo2Mean = sleepSpo2.reduce((a, b) => a + b, 0) / sleepSpo2.length;
        const spo2Var = sleepSpo2.reduce((sum, v) => sum + Math.pow(v - spo2Mean, 2), 0) / sleepSpo2.length;
        const spo2Stability = Math.max(0, 100 - spo2Var * 10);

        return Math.round((hrStability * 0.6 + spo2Stability * 0.4));
    }

    // 8. Total Daily Steps
    function calcTotalSteps(day) {
        return day.steps.reduce((sum, d) => sum + d.v, 0);
    }

    // 9. Active Minutes (>100 steps per 5-min window)
    function calcActiveMinutes(day) {
        return day.steps.filter(d => d.v > 100).length * 5;
    }

    // 10. Sedentary Time (consecutive windows with <5 steps, during awake hours)
    function calcSedentaryTime(day) {
        let sedentary = 0;
        let consecutive = 0;
        day.steps.forEach(d => {
            const h = parseInt(d.t.slice(11, 13));
            if (h < 7) return;
            if (d.v < 5) {
                consecutive++;
                if (consecutive >= 12) sedentary += 5; // 60 min threshold
            } else {
                consecutive = 0;
            }
        });
        return sedentary;
    }

    // 11. Activity Consistency Score (compare 7-day activity timing)
    function calcActivityConsistency(days) {
        const activeHours = days.map(day => {
            const activeWindows = day.steps.filter(d => d.v > 100);
            if (activeWindows.length === 0) return 12;
            const hours = activeWindows.map(d => parseInt(d.t.slice(11, 13)));
            return hours.reduce((a, b) => a + b, 0) / hours.length;
        });
        const mean = activeHours.reduce((a, b) => a + b, 0) / activeHours.length;
        const variance = activeHours.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / activeHours.length;
        return Math.max(0, Math.min(100, Math.round(100 - variance * 8)));
    }

    // 12–16: Composite metrics
    function calcAllMetrics(days) {
        const today = days[days.length - 1];
        const yesterday = days[days.length - 2];

        const rhr = calcRestingHR(today);
        const rhrYesterday = calcRestingHR(yesterday);
        const zones = calcHRZones(today);
        const strain = calcTrainingLoad(zones);
        const hrRecovery = calcHRRecovery(today);
        const stressIndex = calcStressIndex(today);
        const o2Stability = calcO2Stability(today);
        const sleepStability = calcSleepStability(today);
        const totalSteps = calcTotalSteps(today);
        const activeMinutes = calcActiveMinutes(today);
        const sedentaryTime = calcSedentaryTime(today);
        const activityConsistency = calcActivityConsistency(days);

        // 7-day RHR baseline
        const rhrBaseline = days.slice(0, 6).map(calcRestingHR);
        const rhrBaselineAvg = rhrBaseline.reduce((a, b) => a + b, 0) / rhrBaseline.length;
        const rhrDeviation = Math.abs(rhr - rhrBaselineAvg);

        // Recovery Score (0–100): weighted combo
        const rhrScore = Math.max(0, 100 - rhrDeviation * 8);
        const strainPenalty = Math.max(0, 100 - (calcTrainingLoad(calcHRZones(yesterday)) / 21) * 60);
        const recoveryRaw = (
            rhrScore * 0.25 +
            strainPenalty * 0.15 +
            sleepStability * 0.25 +
            o2Stability * 0.15 +
            Math.min(100, hrRecovery * 2.5) * 0.2
        );
        const recoveryScore = Math.max(0, Math.min(100, Math.round(recoveryRaw)));

        // HR Zone total time (active zone 3+)
        const hrZoneTime = zones.slice(2).reduce((a, b) => a + b, 0);

        // Trend data
        const rhrTrend = days.map(calcRestingHR);
        const recoveryTrend = days.map((d, i) => {
            if (i === 0) return recoveryScore;
            const dr = calcRestingHR(d);
            const ds = calcSleepStability(d);
            const doi = calcO2Stability(d);
            return Math.max(0, Math.min(100, Math.round(
                (Math.max(0, 100 - Math.abs(dr - rhrBaselineAvg) * 8)) * 0.3 +
                ds * 0.3 + doi * 0.2 + Math.random() * 20
            )));
        });

        const trendDir = (curr, prev) => curr > prev + 1 ? 'up' : curr < prev - 1 ? 'down' : 'neutral';

        return {
            recoveryScore,
            strain: Math.round(strain * 10) / 10,
            activeMinutes,
            hrZoneTime,
            metrics: [
                {
                    name: 'Resting HR',
                    value: rhr, unit: 'bpm',
                    trend: trendDir(rhrYesterday, rhr), // lower is better, so compare reverse
                    interp: rhr < 60 ? 'Excellent cardiovascular fitness' : rhr < 72 ? 'Healthy resting rate' : 'Slightly elevated today',
                    tooltip: 'Lowest 30-minute average heart rate during your sleep window. Lower values generally indicate better fitness.'
                },
                {
                    name: 'HR Recovery',
                    value: hrRecovery, unit: 'bpm drop',
                    trend: hrRecovery > 30 ? 'up' : hrRecovery > 15 ? 'neutral' : 'down',
                    interp: hrRecovery > 30 ? 'Strong cardiac recovery' : hrRecovery > 15 ? 'Normal recovery rate' : 'Recovery below optimal',
                    tooltip: 'How quickly your heart rate drops after peak activity. Faster drops (higher values) indicate better cardiovascular health.'
                },
                {
                    name: 'O₂ Stability',
                    value: o2Stability, unit: '%',
                    trend: o2Stability > 90 ? 'up' : o2Stability > 70 ? 'neutral' : 'down',
                    interp: o2Stability > 90 ? 'Stable blood oxygen' : o2Stability > 70 ? 'Minor fluctuations noted' : 'Significant SpO₂ drops detected',
                    tooltip: 'Measures how stable your blood oxygen (SpO₂) levels remained. Penalizes drops below 92%.'
                },
                {
                    name: 'Sleep Stability',
                    value: sleepStability, unit: '%',
                    trend: sleepStability > 80 ? 'up' : sleepStability > 60 ? 'neutral' : 'down',
                    interp: sleepStability > 80 ? 'Restful, deep sleep' : sleepStability > 60 ? 'Some restlessness' : 'Poor sleep quality',
                    tooltip: 'A proxy for sleep quality based on heart rate and SpO₂ stability during your sleep window (12am–7am).'
                },
                {
                    name: 'Total Steps',
                    value: totalSteps.toLocaleString(), unit: 'steps',
                    trend: totalSteps > 8000 ? 'up' : totalSteps > 5000 ? 'neutral' : 'down',
                    interp: totalSteps > 8000 ? 'Great daily movement' : totalSteps > 5000 ? 'Moderate activity' : 'Below daily goal',
                    tooltip: 'Total steps recorded throughout the day from your connected device.'
                },
                {
                    name: 'Sedentary Time',
                    value: sedentaryTime, unit: 'min',
                    trend: sedentaryTime < 60 ? 'up' : sedentaryTime < 120 ? 'neutral' : 'down',
                    interp: sedentaryTime < 60 ? 'Low idle time' : sedentaryTime < 120 ? 'Some long sitting periods' : 'Extended inactivity detected',
                    tooltip: 'Time spent without movement for 60+ consecutive minutes during waking hours.'
                },
                {
                    name: 'Consistency',
                    value: activityConsistency, unit: '%',
                    trend: activityConsistency > 80 ? 'up' : activityConsistency > 60 ? 'neutral' : 'down',
                    interp: activityConsistency > 80 ? 'Very consistent routine' : activityConsistency > 60 ? 'Fairly regular pattern' : 'Irregular activity pattern',
                    tooltip: 'How consistent your daily activity timing has been over the past 7 days. Higher scores mean more regularity.'
                },
                {
                    name: 'Stress Index',
                    value: stressIndex, unit: '',
                    trend: stressIndex < 20 ? 'up' : stressIndex < 40 ? 'neutral' : 'down',
                    interp: stressIndex < 20 ? 'Low physiological stress' : stressIndex < 40 ? 'Moderate stress levels' : 'High stress detected',
                    tooltip: 'Percentage of awake time where heart rate was elevated above 100 bpm without corresponding physical activity.'
                },
            ],
            rhrTrend,
            recoveryTrend,
            dayLabels: days.map(d => {
                const dt = new Date(d.date);
                return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()];
            }),
        };
    }

    // ────────────────────────────────────
    //  RENDER
    // ────────────────────────────────────

    function getRecoveryColor(score) {
        if (score >= 70) return 'var(--green)';
        if (score >= 40) return 'var(--orange)';
        return 'var(--red)';
    }

    function getRecoveryLabel(score) {
        if (score >= 70) return 'Train Hard';
        if (score >= 40) return 'Light Training';
        return 'Rest Day';
    }

    function getRecoverySub(score) {
        if (score >= 70) return 'Your body is well recovered — push your limits today';
        if (score >= 40) return 'Partial recovery — keep intensity moderate';
        return 'Your body needs rest — prioritize recovery today';
    }

    function renderRecovery(data) {
        const scoreEl = document.getElementById('recovery-score');
        const ringEl = document.getElementById('ring-progress');
        const labelEl = document.getElementById('recovery-label');
        const subEl = document.getElementById('recovery-sub');

        const circumference = 2 * Math.PI * 88; // ~553
        const offset = circumference - (data.recoveryScore / 100) * circumference;
        const color = getRecoveryColor(data.recoveryScore);

        // Animate score number
        let current = 0;
        const target = data.recoveryScore;
        const duration = 1200;
        const start = performance.now();

        function animateScore(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            current = Math.round(eased * target);
            scoreEl.textContent = current;
            if (progress < 1) requestAnimationFrame(animateScore);
        }
        requestAnimationFrame(animateScore);

        // Ring animation
        setTimeout(() => {
            ringEl.style.stroke = color;
            ringEl.style.strokeDashoffset = offset;
        }, 100);

        labelEl.textContent = getRecoveryLabel(data.recoveryScore);
        labelEl.style.color = color;
        subEl.textContent = getRecoverySub(data.recoveryScore);
    }

    function renderStrain(data) {
        document.getElementById('strain-score').textContent = data.strain;
        document.getElementById('strain-bar').style.width = (data.strain / 21 * 100) + '%';
        document.getElementById('active-minutes').textContent = data.activeMinutes + ' min';
        document.getElementById('hr-zone-time').textContent = data.hrZoneTime + ' min';
    }

    function renderMetrics(data) {
        const grid = document.getElementById('metrics-grid');
        grid.innerHTML = '';

        data.metrics.forEach(m => {
            const card = document.createElement('div');
            card.className = 'metric-card';
            card.setAttribute('data-tooltip', m.tooltip);

            const trendSymbol = m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '→';

            card.innerHTML = `
                <div class="metric-name">${m.name}</div>
                <div class="metric-value-row">
                    <span class="metric-value">${m.value}</span>
                    ${m.unit ? `<span class="metric-unit">${m.unit}</span>` : ''}
                </div>
                <span class="metric-trend ${m.trend}">${trendSymbol}</span>
                <div class="metric-interp">${m.interp}</div>
            `;

            // Tooltip events
            card.addEventListener('mouseenter', showTooltip);
            card.addEventListener('mouseleave', hideTooltip);
            card.addEventListener('touchstart', showTooltip, { passive: true });
            card.addEventListener('touchend', hideTooltip);

            grid.appendChild(card);
        });
    }

    function renderChart(svgId, values, labels, color) {
        const svg = document.getElementById(svgId);
        if (!svg) return;

        const w = 320, h = 120;
        const padX = 30, padY = 18;
        const plotW = w - padX * 2;
        const plotH = h - padY * 2;

        const min = Math.min(...values) - 5;
        const max = Math.max(...values) + 5;
        const range = max - min || 1;

        const points = values.map((v, i) => ({
            x: padX + (i / (values.length - 1)) * plotW,
            y: padY + plotH - ((v - min) / range) * plotH,
        }));

        // Grid lines
        let svgContent = '';
        for (let i = 0; i < 3; i++) {
            const y = padY + (i / 2) * plotH;
            svgContent += `<line class="trend-grid-line" x1="${padX}" y1="${y}" x2="${w - padX}" y2="${y}" />`;
        }

        // Day labels
        points.forEach((p, i) => {
            svgContent += `<text class="trend-label" x="${p.x}" y="${h - 2}" text-anchor="middle">${labels[i]}</text>`;
        });

        // Area fill
        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        const areaD = pathD + ` L${points[points.length - 1].x},${padY + plotH} L${points[0].x},${padY + plotH} Z`;
        svgContent += `<path class="trend-area" d="${areaD}" fill="${color}" />`;

        // Line
        svgContent += `<path class="trend-line" d="${pathD}" stroke="${color}" />`;

        // Dots
        points.forEach(p => {
            svgContent += `<circle class="trend-dot" cx="${p.x}" cy="${p.y}" r="3.5" stroke="${color}" />`;
        });

        // Value labels on dots
        values.forEach((v, i) => {
            svgContent += `<text class="trend-label" x="${points[i].x}" y="${points[i].y - 8}" text-anchor="middle" style="font-weight:600;fill:${color}">${Math.round(v)}</text>`;
        });

        svg.innerHTML = svgContent;
    }

    // ────────────────────────────────────
    //  TOOLTIP
    // ────────────────────────────────────
    const tooltipEl = document.getElementById('tooltip');
    const tooltipText = document.getElementById('tooltip-text');

    function showTooltip(e) {
        const card = e.currentTarget;
        const text = card.getAttribute('data-tooltip');
        if (!text) return;

        tooltipText.textContent = text;
        tooltipEl.classList.remove('hidden');

        const rect = card.getBoundingClientRect();
        tooltipEl.style.left = Math.min(rect.left, window.innerWidth - 260) + 'px';
        tooltipEl.style.top = (rect.top - tooltipEl.offsetHeight - 8) + 'px';

        if (parseFloat(tooltipEl.style.top) < 8) {
            tooltipEl.style.top = (rect.bottom + 8) + 'px';
        }
    }

    function hideTooltip() {
        tooltipEl.classList.add('hidden');
    }

    // ────────────────────────────────────
    //  GREETING
    // ────────────────────────────────────
    function setGreeting() {
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 17) greeting = 'Good afternoon';

        const username = localStorage.getItem('load_username');
        if (username) greeting += `, ${username}`;

        document.getElementById('header-greeting').textContent = greeting;
    }

    // ────────────────────────────────────
    //  INIT & REAL DATA SYNC
    // ────────────────────────────────────
    document.addEventListener('DOMContentLoaded', async () => {
        setGreeting();

        // Check if user is connected to Google Fit and trigger sync
        const urlParams = new URLSearchParams(window.location.search);
        const fitConnected = urlParams.get('fit_connected');

        let token = localStorage.getItem('authToken');
        let hasData = false;

        // Start in empty state
        document.querySelector('.trends-section').style.display = 'none';
        document.getElementById('recovery-label').textContent = 'Loading...';
        document.getElementById('recovery-sub').textContent = 'Checking connection';

        if (token) {
            try {
                const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                    ? 'http://localhost:5000'
                    : 'https://load-app-v1-api.vercel.app';

                const response = await fetch(`${API_BASE}/api/fit/sync`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const syncResult = await response.json();
                    if (syncResult && syncResult.data) {
                        hasData = true;
                        console.log("Real data synced from Google Fit:", syncResult.data);

                        // We have real data! Let's render the mock charts with real inserts for now
                        // (In a full prod app we would override the whole 'days' generator with real arrays)
                        const days = generate7Days();
                        let data = calcAllMetrics(days);

                        const realData = syncResult.data;
                        if (realData.recovery_score) {
                            data.recoveryScore = realData.recovery_score;
                        }
                        if (realData.resting_heart_rate) {
                            data.metrics[0].value = realData.resting_heart_rate;
                        }
                        if (realData.total_steps) {
                            data.metrics[4].value = realData.total_steps.toLocaleString();
                        }

                        renderRecovery(data);
                        renderStrain(data);
                        renderMetrics(data);
                        document.querySelector('.trends-section').style.display = 'block';
                        renderChart('rhr-chart', data.rhrTrend, data.dayLabels, '#ef4444');
                        renderChart('recovery-chart', data.recoveryTrend, data.dayLabels, '#22c55e');
                    }
                }

            } catch (err) {
                console.error("Failed to sync with backend.", err);
            }
        }

        // Render Empty State if no real data was found
        if (!hasData) {
            document.getElementById('recovery-score').textContent = "--";
            document.getElementById('ring-progress').style.stroke = "var(--border)";
            document.getElementById('ring-progress').style.strokeDashoffset = 553; // empty

            document.getElementById('recovery-label').textContent = "No Data";
            document.getElementById('recovery-label').style.color = "var(--text-sec)";

            // Turn the sub title into a connect button link
            document.getElementById('recovery-sub').innerHTML = `
                <a href="connect-googlefit.html" style="color:var(--text); text-decoration:underline; font-weight:600; font-size: 1.1rem; padding: 10px; display:inline-block; background:rgba(255,255,255,0.05); border-radius: 8px; margin-top: 5px;">
                  Connect Google Fit
                </a>
            `;

            document.getElementById('strain-score').textContent = "--";
            document.getElementById('strain-bar').style.width = '0%';
            document.getElementById('active-minutes').textContent = '-- min';
            document.getElementById('hr-zone-time').textContent = '-- min';

            // Render empty metrics grid
            const emptyMetrics = [
                { name: 'Resting HR', value: '--', tooltip: 'Connect Google Fit to track.' },
                { name: 'HR Recovery', value: '--', tooltip: 'Connect Google Fit to track.' },
                { name: 'O₂ Stability', value: '--', tooltip: 'Connect Google Fit to track.' },
                { name: 'Sleep Stability', value: '--', tooltip: 'Connect Google Fit to track.' },
                { name: 'Total Steps', value: '--', tooltip: 'Connect Google Fit to track.' },
                { name: 'Sedentary Time', value: '--', tooltip: 'Connect Google Fit to track.' },
                { name: 'Consistency', value: '--', tooltip: 'Connect Google Fit to track.' },
                { name: 'Stress Index', value: '--', tooltip: 'Connect Google Fit to track.' }
            ];

            const grid = document.getElementById('metrics-grid');
            grid.innerHTML = '';
            emptyMetrics.forEach(m => {
                grid.innerHTML += `
                    <div class="metric-card" data-tooltip="${m.tooltip}">
                        <div class="metric-name">${m.name}</div>
                        <div class="metric-value-row">
                            <span class="metric-value">${m.value}</span>
                        </div>
                    </div>
                `;
            });
        }
    });

})();
