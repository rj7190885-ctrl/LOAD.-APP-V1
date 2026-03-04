const { OAuth2Client } = require('google-auth-library');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Ensure these exist in environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

// Initialize Google OAuth Client
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Initialize Supabase Client (to talk to your database locally)
// Uses service role or anon key
const supabaseUrl = process.env.SUPABASE_URL || 'https://apviaoddzidcecjhcknd.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Handle Google Login Callback mapping to Supabase User
 */
exports.googleLogin = async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ error: 'Google ID token (credential) is required' });
        }

        // 1. Verify the Google ID Token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        // 2. Check if user already exists in Supabase
        let { data: user, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('google_id', googleId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            // PGRST116 means no row found, which is fine
            throw fetchError;
        }

        // 3. If User doesn't exist, create one
        if (!user) {
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([
                    {
                        google_id: googleId,
                        email: email,
                        name: name,
                        picture: picture
                    }
                ])
                .select()
                .single();

            if (insertError) throw insertError;
            user = newUser;
        } else {
            // Update user picture/name just in case they changed
            await supabase
                .from('users')
                .update({ picture, name, updated_at: new Date() })
                .eq('google_id', googleId);
        }

        // 4. Generate Application JWT for session management
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // 5. Send back success with token and basic user info
        return res.status(200).json({
            message: 'Login successful',
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                picture: user.picture
            }
        });

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(500).json({ error: 'Authentication failed. Please try again later.' });
    }
};
