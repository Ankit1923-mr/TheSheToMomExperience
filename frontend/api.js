// --- API MODULE ---
// Handles all communication with the backend server.
// No API keys live here.

/**
 * The base URLs for the Gemini models.
 * We send this to our proxy, which adds the key.
 */
const GEMINI_URLS = {
    flash: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent",
    // Add other models here if needed
};

/**
 * Fetches the Firebase config from our secure backend server.
 * @returns {Promise<object>} Firebase config object
 */
export async function fetchFirebaseConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error('Could not fetch Firebase config from server.');
        }
        return await response.json();
    } catch (error) {
        console.error("Fatal Error fetching config:", error);
        // Show error to user
        document.body.innerHTML = `<div style="padding: 2rem; text-align: center; font-family: sans-serif; color: red;">
            <h1>Connection Error</h1>
            <p>Could not connect to the backend server at /api/config.</p>
            <p>Please ensure the backend server is running.</p>
        </div>`;
        throw error;
    }
}

/**
 * Calls our backend proxy to securely run a Gemini API request.
 * @param {string} modelUrl - The base URL of the Gemini model to use (from GEMINI_URLS).
 * @param {object} payload - The request payload to send to Gemini.
 * @returns {Promise<object>} The JSON response from Gemini.
 */
export async function callGemini(modelUrl, payload) {
    try {
        const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiUrl: modelUrl, // The backend needs to know which Gemini URL to hit
                payload: payload,   // The backend will forward this payload
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error from proxy server:', errorData);
            throw new Error(`Proxy error: ${errorData.error || response.statusText}`);
        }

        return await response.json();

    } catch (error) {
        console.error('Error calling Gemini proxy:', error);
        throw error;
    }
}

// We can export the URLs to be used by app.js
export { GEMINI_URLS };
