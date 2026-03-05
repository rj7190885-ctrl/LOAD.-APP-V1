const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET; // Ensure this is set in .env
const REDIRECT_URI = process.env.GOOGLE_FIT_REDIRECT_URI || 'http://localhost:5000/api/fit/callback'; // Configure in Google Cloud

const supabaseUrl = process.env.SUPABASE_URL || 'https://apviaoddzidcecjhcknd.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
);

// Scopes needed for fitness data
const FIT_SCOPES = [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.heart_rate.read',
    'https://www.googleapis.com/auth/fitness.blood_pressure.read',
    'https://www.googleapis.com/auth/fitness.blood_glucose.read',
    'https://www.googleapis.com/auth/fitness.oxygen_saturation.read'
];

/**
 * Generate Auth URL for Google Fit
 */
exports.getAuthUrl = (userId) => {
    // Pass the user ID in the state so we know who to link the tokens to upon callback
    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // Required to get refresh token
        prompt: 'consent',     // Force consent to always get refresh token
        scope: FIT_SCOPES,
        state: userId
    });
};

/**
 * Handle Google Fit OAuth Callback
 */
exports.handleCallback = async (code, state) => {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        const userId = state; // We passed userId in the state parameter

        // Update or Insert into user_integrations table
        const { error } = await supabase
            .from('user_integrations')
            .upsert({
                user_id: userId,
                provider: 'google_fit',
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token, // Might be undefined if not first time (thus prompt: consent above)
                expires_at: new Date(tokens.expiry_date).toISOString()
            }, { onConflict: 'user_id, provider' });

        if (error) {
            console.error("Supabase upsert error:", error);
            throw error;
        }

        return tokens;
    } catch (error) {
        throw error;
    }
};

/**
 * Helper to fetch aggregated data from Google Fit API
 * dataSourceId examples:
 * - 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
 * - 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended'
 * - 'derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm'
 */
async function fetchAggregatedData(fitnessAuth, dataSourceId, startTimeMillis, endTimeMillis) {
    const fitness = google.fitness({ version: 'v1', auth: fitnessAuth });
    try {
        const res = await fitness.users.dataset.aggregate({
            userId: 'me',
            requestBody: {
                aggregateBy: [{ dataTypeName: dataSourceId }],
                bucketByTime: { durationMillis: endTimeMillis - startTimeMillis }, // One huge bucket for the period
                startTimeMillis: startTimeMillis,
                endTimeMillis: endTimeMillis
            }
        });

        const bucket = res.data.bucket[0];
        if (bucket && bucket.dataset[0] && bucket.dataset[0].point.length > 0) {
            const point = bucket.dataset[0].point[0];
            // Format varies by type (int, fp)
            if (point.value && point.value[0]) {
                return point.value[0].intVal || point.value[0].fpVal;
            }
        }
        return 0; // Default if no data
    } catch (err) {
        console.error(`Error fetching ${dataSourceId}:`, err.message);
        return 0;
    }
}

/**
 * Helper to fetch daily min/max/avg for Heart Rate for Resting HR calculation
 * We use aggregate over the day
 */
async function fetchAverageHeartRate(fitnessAuth, startTimeMillis, endTimeMillis) {
    const fitness = google.fitness({ version: 'v1', auth: fitnessAuth });
    try {
        // 'com.google.heart_rate.bpm' aggregate usually returns average, max, min
        const res = await fitness.users.dataset.aggregate({
            userId: 'me',
            requestBody: {
                aggregateBy: [{ dataTypeName: 'com.google.heart_rate.bpm' }],
                bucketByTime: { durationMillis: endTimeMillis - startTimeMillis },
                startTimeMillis: startTimeMillis,
                endTimeMillis: endTimeMillis
            }
        });

        const bucket = res.data.bucket[0];
        if (bucket && bucket.dataset[0] && bucket.dataset[0].point.length > 0) {
            const values = bucket.dataset[0].point[0].value;
            // values[0] is often average, 1 max, 2 min depending on aggregation
            // For com.google.heart_rate.summary, it's [average, max, min]
            if (values && values[0]) {
                return values[0].fpVal || 0; // Returning average as a proxy for RHR for now
            }
        }
        return null;
    } catch (err) {
        console.error("Error fetching heart rate:", err.message);
        return null;
    }
}

/**
 * Fetch sleep sessions to calculate total duration
 */
async function fetchSleepDuration(fitnessAuth, startTimeMillis, endTimeMillis) {
    const fitness = google.fitness({ version: 'v1', auth: fitnessAuth });
    try {
        // Sleep uses session API often, but can try aggregate if dataset exists.
        // Actually, for Sleep, querying the sessions API is more reliable.
        const res = await fitness.users.sessions.list({
            userId: 'me',
            startTime: new Date(startTimeMillis).toISOString(),
            endTime: new Date(endTimeMillis).toISOString(),
            activityType: 72 // Sleep activity type
        });

        let totalSleepMinutes = 0;
        if (res.data.session) {
            res.data.session.forEach(session => {
                const durationMillis = Number(session.endTimeMillis) - Number(session.startTimeMillis);
                totalSleepMinutes += (durationMillis / (1000 * 60));
            });
        }
        return totalSleepMinutes;

    } catch (err) {
        console.error("Error fetching sleep:", err.message);
        return 0;
    }
}


/**
 * Sync user data from Google Fit to Supabase for a specific date
 * Default is 'today' relative to user's timezone or UTC
 */
exports.syncUserData = async (userId, targetDate = new Date()) => {
    try {
        // 1. Fetch Integration Tokens
        const { data: integration, error } = await supabase
            .from('user_integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('provider', 'google_fit')
            .single();

        if (error || !integration) {
            throw new Error('Google Fit not connected or tokens missing.');
        }

        // 2. Set Credentials
        const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
        client.setCredentials({
            access_token: integration.access_token,
            refresh_token: integration.refresh_token,
            // Note: if you saved expiry date, you might want to handle automatic refreshing via oauth2Client events
        });

        // Calculate start and end of day in Milliseconds
        // Note: For a real production app, consider the user's specific timezone.
        // Using UTC bounds for simplicity here.
        const startOfDay = new Date(targetDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const startTimeMillis = startOfDay.getTime();

        const endOfDay = new Date(targetDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        const endTimeMillis = endOfDay.getTime();

        // 3. Fetch various metrics in parallel
        const [steps, calories, avgHeartRate, sleepMinutes] = await Promise.all([
            fetchAggregatedData(client, 'com.google.step_count.delta', startTimeMillis, endTimeMillis),
            fetchAggregatedData(client, 'com.google.calories.expended', startTimeMillis, endTimeMillis),
            fetchAverageHeartRate(client, startTimeMillis, endTimeMillis),
            fetchSleepDuration(client, startTimeMillis, endTimeMillis)
        ]);

        // Basic mock calculation for Recovery Score (0-100)
        // If they slept 8 hours (480 min), lower avg HR is better.
        let recoveryScore = 50; // default
        if (sleepMinutes > 0 && avgHeartRate > 0) {
            // Very rudimentary mock formula
            recoveryScore = Math.min(100, Math.max(0, (sleepMinutes / 480 * 50) + ((1 - (avgHeartRate - 50) / 50) * 50)));
        }
        recoveryScore = Math.round(recoveryScore);

        // 4. Upsert Data to Supabase
        const summaryDate = startOfDay.toISOString().split('T')[0]; // YYYY-MM-DD

        const { data: summary, error: dbError } = await supabase
            .from('daily_health_summaries')
            .upsert({
                user_id: userId,
                date: summaryDate,
                total_steps: Math.round(steps),
                total_calories: Math.round(calories),
                resting_heart_rate: avgHeartRate ? Math.round(avgHeartRate) : null,
                sleep_duration: Math.round(sleepMinutes),
                recovery_score: recoveryScore,
                // Add more fields here as you fetch them
            }, { onConflict: 'user_id, date' })
            .select()
            .single();

        if (dbError) throw dbError;

        return summary;

    } catch (err) {
        console.error("Sync user data error:", err);
        throw err;
    }
};
