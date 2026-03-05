const testApi = async () => {
    try {
        console.log("Testing POST to live Render API...");
        const res = await fetch('https://load-backend-k7na.onrender.com/api/auth/google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://load-app-v1.vercel.app'
            },
            body: JSON.stringify({ credential: 'dummy_token_to_test_connection' })
        });

        console.log("Status:", res.status);
        console.log("Headers:", [...res.headers.entries()]);

        const data = await res.json();
        console.log("Response Body:", data);
    } catch (err) {
        console.error("Fetch failed completely:", err.message);
    }
};

testApi();
