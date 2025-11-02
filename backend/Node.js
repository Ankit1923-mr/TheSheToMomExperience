// Import required packages
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios'); // Used for making HTTP requests

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = 3000;

// --- Middleware ---
// 1. Enable CORS (Cross-Origin Resource Sharing)
app.use(cors());
// 2. Enable parsing of JSON request bodies
app.use(express.json());
// 3. Serve all files from the 'frontend' folder
app.use(express.static('../frontend'));

// --- API Routes ---

/**
 * NEW: Securely serves the Firebase config to the client.
 * The client no longer has any hard-coded keys.
 */
app.get('/api/config', (req, res) => {
    // Read config from server environment variables
    const firebaseConfig = {
        apiKey: process.env.FB_API_KEY,
        authDomain: process.env.FB_AUTH_DOMAIN,
        projectId: process.env.FB_PROJECT_ID,
        storageBucket: process.env.FB_STORAGE_BUCKET,
        messagingSenderId: process.env.FB_MESSAGING_SENDER_ID,
        appId: process.env.FB_APP_ID,
        measurementId: process.env.FB_MEASUREMENT_ID
    };
    
    // Check if all keys are present
    if (Object.values(firebaseConfig).some(key => !key)) {
        console.error("Firebase config keys are missing from .env file!");
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    res.json(firebaseConfig);
});


/**
 * A secure proxy endpoint for all Gemini API calls.
 * The client sends the 'apiUrl' and 'payload'.
 * This server adds the secret API key and forwards the request.
 */
app.post('/api/proxy', async (req, res) => {
    // Get the API key from the secure .env file
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'API key not configured on server.' });
    }

    const { apiUrl, payload } = req.body;

    if (!apiUrl || !payload) {
        return res.status(400).json({ error: 'Missing apiUrl or payload' });
    }

    try {
        // Construct the full, secure URL with the API key
        const fullUrl = `${apiUrl}?key=${GEMINI_API_KEY}`;

        // Make the request to the Gemini API using axios
        const response = await axios.post(fullUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        // Send the response from Gemini back to our client
        res.json(response.data);

    } catch (error) {
        console.error('Error in Gemini proxy:', error.response ? error.response.data : error.message);
        res.status(error.response ? error.response.status : 500).json({ 
            error: 'Failed to fetch from Gemini API', 
            details: error.response ? error.response.data : error.message 
        });
    }
});

// --- Start the Server ---
// Use the port Render provides, or 3000 for local testing
const PORT = process.env.PORT || 3000; 

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Serving frontend from ../frontend directory');
});
