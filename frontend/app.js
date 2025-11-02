// --- MAIN APP LOGIC (app.js) ---

// Import Firebase services
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc, 
    onSnapshot, 
    collection, 
    query, 
    orderBy, 
    serverTimestamp, 
    deleteDoc,
    setLogLevel,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import modular code
import * as API from './api.js';
import * as UI from './ui.js';

// --- GLOBAL VARIABLES & INITIALIZATION ---

let db;
let auth;
let userId = null;
let userName = "Mom"; // Default name
let isMomRole = false; 

// --- MODIFIED PATHS for local use (removed appId) ---
const PROFILE_PATH = (uid) => `/users/${uid}/profile/main`;
const journalCollectionPath = () => `/users/${userId}/journals`;
const matchCollectionPath = () => `/users/${userId}/peer_matches`; 

/**
 * Initializes Firebase and sets up the authentication listener.
 * This is now asynchronous and fetches the config from the server.
 */
async function initializeAppAndAuth() {
    try {
        // 1. Fetch the secure config from our backend
        const firebaseConfig = await API.fetchFirebaseConfig();
        
        // 2. Initialize Firebase
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        setLogLevel('Debug'); // Enable Firestore debugging

        // 3. Set up the Auth State Listener
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in
                userId = user.uid;
                isMomRole = true; 
                
                await loadUserProfile(); 
                updateUserDisplay(); 
                toggleLogoutButtons(true); 

                setupJournalListener();
                getDailyThought(); 
                
                changeScreen('dashboard');
            } else {
                // User is signed out
                userId = null;
                isMomRole = false;
                userName = "Mom"; 
                
                updateUserDisplay(); 
                toggleLogoutButtons(false); 
                
                changeScreen('login-screen'); 
            }
        });

    } catch (error) {
        console.error("Failed to initialize app:", error);
        // The API.fetchFirebaseConfig function will have already shown an error to the user
    }
}

// --- NEW AUTHENTICATION FUNCTIONS ---

/**
 * Handles Email/Password Login
 */
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('auth-error');
    errorEl.classList.add('hidden'); 

    if (!email || !password) {
        errorEl.textContent = 'Please enter both email and password.';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle the redirect
    } catch (error) {
        console.error("Login Error:", error.code);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            errorEl.textContent = 'No such user exists. Please Sign Up.';
        } else if (error.code === 'auth/wrong-password') {
            errorEl.textContent = 'Incorrect password. Please try again.';
        } else {
            errorEl.textContent = 'An error occurred. Please try again.';
        }
        errorEl.classList.remove('hidden');
    }
}

/**
 * Handles New User Signup (UPDATED)
 */
async function handleSignup() {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const age = document.getElementById('signup-age').value.trim();
    const location = document.getElementById('signup-location').value.trim();
    
    const errorEl = document.getElementById('signup-error');
    errorEl.classList.add('hidden');

    if (!name || !email || password.length < 6 || !age || !location) {
        errorEl.textContent = 'Please fill out all fields. Password needs 6 characters.';
        errorEl.classList.remove('hidden');
        return;
    }
     if (parseInt(age) < 18) {
        errorEl.textContent = 'You must be at least 18 to sign up.';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        // 1. Create the user in Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // 2. Immediately save their full profile to Firestore
        await saveUserProfileData(user.uid, name, email, parseInt(age), location);
        
        // onAuthStateChanged will handle the rest
    } catch (error) {
        console.error("Signup Error:", error.code);
        if (error.code === 'auth/email-already-in-use') {
            errorEl.textContent = 'This email is already in use. Please Login.';
        } else {
            errorEl.textContent = 'Could not create account. Please try again.';
        }
        errorEl.classList.remove('hidden');
    }
}

/**
 * Handles Forgot Password Request
 */
async function handlePasswordReset() {
    const email = document.getElementById('reset-email').value;
    const successEl = document.getElementById('reset-success');
    const errorEl = document.getElementById('reset-error');
    successEl.classList.add('hidden');
    errorEl.classList.add('hidden');

    if (!email) {
        errorEl.textContent = 'Please enter your email address.';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        successEl.textContent = 'Success! Check your email for a reset link.';
        successEl.classList.remove('hidden');
    } catch (error) {
        console.error("Reset Error:", error.code);
        errorEl.textContent = 'Could not send reset link. Please check the email.';
        errorEl.classList.remove('hidden');
    }
}

/**
 * Handles User Logout
 */
async function handleLogout() {
    try {
        await signOut(auth);
        // onAuthStateChanged will handle the redirect
    } catch (error) {
        console.error("Logout Error:", error);
        UI.alertUser('Could not log out. Please try again.', 'Error');
    }
}

/**
 * Toggles visibility of Logout buttons
 */
function toggleLogoutButtons(show) {
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.style.display = show ? 'flex' : 'none';
    });
}

// --- PROFILE FUNCTIONS ---

/**
 * Loads user profile from Firestore.
 */
async function loadUserProfile() {
    if (!userId) return;
    try {
        const docRef = doc(db, PROFILE_PATH(userId));
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            userName = data.name || "Mom";
            
            // Set inputs on profile page
            document.getElementById('profile-name').value = data.name || "";
            document.getElementById('profile-email').value = data.email || "";
            document.getElementById('profile-age').value = data.age || "";
            document.getElementById('profile-location').value = data.location || "";
        } else {
            console.warn("No profile found for user, will use defaults.");
            userName = "Mom";
        }
        updateUserDisplay(); // Update welcome message
    } catch (error) {
        console.error("Error loading user profile:", error);
    }
}

/**
 * Saves user profile from the "Profile Setup" screen.
 */
async function saveUserProfile() {
    if (!userId) { 
        UI.alertUser('You are not logged in. Please refresh and log in again.', 'Error');
        return;
    }

    const successEl = document.getElementById('profile-success');
    const errorEl = document.getElementById('profile-error');
    successEl.classList.add('hidden');
    errorEl.classList.add('hidden');

    const name = document.getElementById('profile-name').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const age = document.getElementById('profile-age').value.trim();
    const location = document.getElementById('profile-location').value.trim();

    if (name.length < 2 || !email.includes('@') || !age || parseInt(age) < 18) {
        errorEl.textContent = 'Please enter a valid name, email, and age.';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        // 1. Save the data
        await saveUserProfileData(userId, name, email, parseInt(age), location);
        
        // 2. Refresh global user name
        userName = name;
        updateUserDisplay();
        
        // 3. Show success message on the page
        successEl.textContent = 'Profile updated successfully!';
        successEl.classList.remove('hidden');

        // 4. Hide success message after 3 seconds
        setTimeout(() => {
            successEl.classList.add('hidden');
        }, 3000);

    } catch (error) {
        console.error("Error saving profile:", error);
        errorEl.textContent = 'Could not update profile. Please try again.';
        errorEl.classList.remove('hidden');
    }
}

/**
 * Re-usable helper function to save profile data
 */
async function saveUserProfileData(uid, name, email, age, location) {
    const profileData = { 
        name, 
        email, 
        age, 
        location, 
        lastUpdated: serverTimestamp() 
    };
    // Use setDoc with merge:true to create or update
    await setDoc(doc(db, PROFILE_PATH(uid)), profileData, { merge: true });
}


/**
 * Updates the header and dashboard welcome text.
 */
function updateUserDisplay() {
    const userText = userId ? `Logged in` : 'Not logged in';
    document.getElementById('user-display').textContent = userText;
    document.getElementById('user-display-mobile').textContent = userText;
    document.getElementById('mom-name-display').textContent = userName;
}


// --- SCREEN MANAGEMENT & AI DAILY INSIGHT ---

/**
 * Calls Gemini for a positive, high-level thought of the day.
 */
async function getDailyThought() {
    const insightEl = document.getElementById('daily-insight-text');
    if (!insightEl) return;
    
    insightEl.innerHTML = `Hello <span>${userName}</span>, You got this. Loading your daily encouragement...`;

    const systemPrompt = `You are an empathetic, nurturing voice for new mothers. Your task is to provide a single, short, and powerful affirmation or supportive thought for the day. Start your response with a positive, encouraging phrase like 'Your strength shines through.' or 'You are doing amazing.'. Keep the total message under 20 words.`;
    
    const payload = {
        contents: [{ parts: [{ text: "Generate a powerful and encouraging thought of the day for a new mother." }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    try {
        // Use the new API module to call the proxy
        const result = await API.callGemini(API.GEMINI_URLS.flash, payload);
        
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text.trim() || "You are doing amazing. Rest, and let love guide you.";
        
        const finalMessage = `Hello <span>${userName}</span>, You got this. ${text.replace(/["“”]/g, '')}`;
        insightEl.innerHTML = finalMessage;

    } catch (error) {
        console.error("Error generating daily thought:", error);
        insightEl.innerHTML = `Hello <span>${userName}</span>, You got this. Self-care is not selfish, it is sacred.`;
    }
}

/**
 * Hides all screens and shows the requested one.
 */
async function changeScreen(screenId) {
    const authScreens = ['login-screen', 'signup-screen', 'forgot-password-screen'];
    if (!userId && !authScreens.includes(screenId)) {
        console.warn("User not logged in. Redirecting to login.");
        screenId = 'login-screen';
    }

    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.remove('hidden');
        window.scrollTo(0, 0); 
    }

    // Specific pre-load logic
    if (screenId === 'care-plan') {
        await loadCarePlanDefaults();
    }
    if (screenId === 'dashboard') {
        await loadUserProfile(); 
    }
     if (screenId === 'profile-setup') {
        await loadUserProfile(); // Ensure fields are populated for editing
    }
    if (screenId === 'peer-chat') {
        document.getElementById('chat-reply-content').value = '';
    }
}


// --- CORE FEATURE 1: AI CARE PLAN (Journal Data Integration) ---

let latestJournalContent = "";

async function loadCarePlanDefaults() {
    if (!userId) return;
    
    const q = query(collection(db, journalCollectionPath()), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q); 

    if (!snapshot.empty) {
        const latestEntry = snapshot.docs[0].data();
        latestJournalContent = latestEntry.content;
        document.getElementById('plan-query').value = `[Loaded from Journal - ${new Date(latestEntry.timestamp.toDate()).toLocaleDateString()}]\n\n${latestJournalContent}`;
        document.getElementById('plan-query').placeholder = `Using journal data... You can still modify this if needed.`;
    } else {
        latestJournalContent = "";
        document.getElementById('plan-query').value = '';
        document.getElementById('plan-query').placeholder = 'Example: I feel very low energy, struggling with sleep, and have a mild headache...';
    }
}

async function generateCarePlan() {
    if (!isMomRole) { UI.alertUser('You must be logged in to use this feature.', 'Error'); return; }

    let query = document.getElementById('plan-query').value.trim();

    if (query.startsWith('[Loaded from Journal')) {
         query = latestJournalContent;
    }
    
    if (query.length < 10) {
        UI.alertUser('Please provide a detailed description of your current state (mood, symptoms, energy).', 'Warning');
        return;
    }

    const button = document.getElementById('generate-plan-btn');
    const spinner = document.getElementById('plan-spinner');
    const resultsDiv = document.getElementById('plan-content');
    const sourcesDiv = document.getElementById('plan-sources');
    
    button.disabled = true;
    spinner.classList.remove('hidden');
    resultsDiv.innerHTML = `<p class="text-gray-500">Generating culturally-rooted Ayurvedic plan...</p>`;
    sourcesDiv.classList.add('hidden');

    const systemPrompt = `You are a warm, empathetic "Dai" (traditional midwife/caregiver) AI specializing in Indian Vedic and Ayurvedic postpartum wellness. Your goal is to provide supportive, concise, and culturally relevant advice. Based on the user's description, provide a 3-part plan (Food, Body, Mind) using traditional Indian and Ayurvedic concepts.
    **Structure the output strictly as follows:**
    1.  **Based on your description...** (A brief, empathetic acknowledgement of their state, using nurturing language)
    2.  **Food (Ahara):** Provide 2-3 specific, warming, and easily digestible food recommendations (e.g., moong dal khichdi, haldi doodh, dry fruit laddoo).
    3.  **Body (Vihara):** Provide 2-3 recommendations for physical comfort or routine (e.g., oil massage (abhyanga), warm water baths, gentle yoga).
    4.  **Mind (Mana):** Provide 2-3 recommendations for emotional/mental peace (e.g., a simple breathing exercise, a culturally relevant mantra, quiet time).
    The tone must be encouraging and nurturing.`;

    const userQuery = `My current state is: "${query}"`;
    
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        tools: [{ "google_search": {} }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    try {
        const result = await API.callGemini(API.GEMINI_URLS.flash, payload);
        
        const candidate = result.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a plan right now. Please try again later.";

        let sources = [];
        const groundingMetadata = candidate?.groundingMetadata;
        if (groundingMetadata?.groundingAttributions) {
            sources = groundingMetadata.groundingAttributions
                .map(attr => ({ uri: attr.web?.uri, title: attr.web?.title, }))
                .filter(source => source.uri && source.title);
        }

        resultsDiv.textContent = text;
        
        if (sources.length > 0) {
            sourcesDiv.innerHTML = 'Sources: ' + sources.map((s, i) => 
                `<a href="${s.uri}" target="_blank" class="text-deep-pink hover:text-dark-pink hover:underline">${s.title.substring(0, 50)}...</a>`
            ).join(' | ');
            sourcesDiv.classList.remove('hidden');
        } else {
            sourcesDiv.classList.add('hidden');
        }

    } catch (error) {
        console.error("Error generating care plan:", error);
        resultsDiv.innerHTML = `<p class="text-red-500">Could not connect to the AI caregiver. Please check your network.</p>`;
    } finally {
        button.disabled = false;
        spinner.classList.add('hidden');
    }
}


// --- CORE FEATURE 2: EMOTIONAL JOURNALING ---

async function saveJournalEntry() {
    if (!isMomRole) { UI.alertUser('You must be logged in to use this feature.', 'Error'); return; }

    const entryContent = document.getElementById('journal-entry').value.trim();
    if (entryContent.length < 5) {
        UI.alertUser('Please write a more complete thought before saving.', 'Warning');
        return;
    }

    const button = document.getElementById('save-journal-btn');
    button.disabled = true;
    button.textContent = 'Analyzing and Saving...';

    try {
        const moodAnalysis = await getMoodAnalysis(entryContent);
        
        await addDoc(collection(db, journalCollectionPath()), {
            content: entryContent,
            timestamp: serverTimestamp(),
            mood: moodAnalysis.mood,
            insight: moodAnalysis.insight
        });

        document.getElementById('journal-entry').value = '';
        UI.alertUser('Journal entry saved and analyzed successfully!', 'Success');

    } catch (error) {
        console.error("Error saving journal entry or getting analysis:", error);
        UI.alertUser('An error occurred while saving the journal. See console for details.', 'Error');
    } finally {
        button.disabled = false;
        button.textContent = 'Save Entry & Analyze Mood';
    }
}

async function getMoodAnalysis(entryContent) {
    const systemPrompt = `Analyze the user's journal entry for overall emotional state (mood) and provide a concise, empathetic, and culturally sensitive single-sentence insight or observation based on the content. The mood should be a single word (e.g., 'Tired', 'Anxious', 'Joyful').`;
    const userQuery = `Analyze the following journal entry written by a new mother: "${entryContent}"`;
    
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "mood": { "type": "STRING", "description": "The primary single-word mood detected." },
                    "insight": { "type": "STRING", "description": "A single, supportive sentence of insight based on the entry." }
                },
                "propertyOrdering": ["mood", "insight"]
            }
        }
    };

    try {
        const result = await API.callGemini(API.GEMINI_URLS.flash, payload);
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonText) {
            return JSON.parse(jsonText);
        } else {
            throw new Error("Invalid JSON response from AI.");
        }
    } catch (error) {
        console.error("AI Mood Analysis Error:", error);
        return { mood: 'Reflective', insight: 'It takes courage to write your feelings. Keep going.' };
    }
}

function setupJournalListener() {
    if (!db || !userId) return;

    const q = query(collection(db, journalCollectionPath()), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        const listEl = document.getElementById('journal-list');
        listEl.innerHTML = '';
        
        if (snapshot.empty) {
            listEl.innerHTML = '<p class="text-gray-500 text-sm italic">You have no journal entries yet. Write your first one above!</p>';
            return;
        }

        snapshot.forEach(docSnap => {
            const entry = docSnap.data();
            const date = entry.timestamp ? new Date(entry.timestamp.toDate()).toLocaleDateString() : 'N/A';

            const item = document.createElement('div');
            item.className = 'bg-white p-4 rounded-lg shadow-md border-l-4 border-pink-400 transform hover:scale-[1.01] transition duration-200';
            item.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-lg text-pink-700">${date} - Mood: <span class="font-extrabold">${entry.mood}</span></h4>
                    <button data-doc-id="${docSnap.id}" class="delete-journal-btn text-gray-400 hover:text-red-500 transition duration-150">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
                <p class="text-gray-800 italic">${entry.content}</p>
                <div class="mt-3 pt-2 border-t border-pink-100">
                    <span class="text-sm font-semibold text-deep-pink">AI Insight: </span>
                    <span class="text-sm text-gray-600">${entry.insight}</span>
                </div>
            `;
            listEl.appendChild(item);
        });

        // Add event listeners to delete buttons
        listEl.querySelectorAll('.delete-journal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Use currentTarget to get the button, even if SVG is clicked
                const docId = e.currentTarget.getAttribute('data-doc-id');
                deleteJournalEntry(docId);
            });
        });
    });
}

async function deleteJournalEntry(docId) {
    if (!isMomRole) { UI.alertUser('You do not have permission to delete.', 'Error'); return; }

    const confirmed = await UI.showCustomModal('Delete Entry', 'Are you sure you want to permanently delete this journal entry?');
    if (confirmed) {
        try {
            await deleteDoc(doc(db, journalCollectionPath(), docId)); 
            UI.alertUser('Entry deleted successfully.', 'Success');
        } catch (error) {
            console.error("Error deleting document: ", error);
            UI.alertUser('Could not delete entry.', 'Error');
        }
    }
}


// --- CORE FEATURE 3: COMMUNITY CONNECT (AI Peer Matching Simulation) ---

let chatHistory = [];

async function startPeerMatch() {
    if (!isMomRole) { UI.alertUser('You must be logged in to use this feature.', 'Error'); return; }

    const mood = document.getElementById('match-mood').value;
    const health = document.getElementById('match-health').value;
    const problem = document.getElementById('match-problem').value.trim();
    const preference = document.getElementById('match-preference').value.trim();

    if (problem.length < 10) {
        UI.alertUser('Please describe the problem you want to discuss.', 'Warning');
        return;
    }

    const button = document.getElementById('start-match-btn');
    const spinner = document.getElementById('match-spinner');
    
    button.disabled = true;
    spinner.classList.remove('hidden');
    document.getElementById('match-error').classList.add('hidden');
    button.textContent = 'Matching you with a peer...';

    const matchProfile = {
        userId: userId,
        name: userName,
        mood: mood,
        health: health,
        problem: problem,
        preference: preference,
        timestamp: serverTimestamp()
    };

    try {
        const aiResponse = await getAiPeerMatchResponse(matchProfile);
        
        chatHistory = [];
        document.getElementById('chat-container').innerHTML = '';

        addMessageToChat('Peer', aiResponse, true); 
        changeScreen('peer-chat');

    } catch (error) {
        console.error("Error during peer match:", error);
        document.getElementById('match-error').textContent = 'Error starting match. Please try again.';
        document.getElementById('match-error').classList.remove('hidden');
    } finally {
        button.disabled = false;
        spinner.classList.add('hidden');
        button.textContent = 'Find My Peer Support';
    }
}

async function getAiPeerMatchResponse(profileData) {
    const systemPrompt = `You are an empathetic, anonymous mother (Peer Mom) who has been matched with another new mother based on their current problem. Your goal is to start a supportive, culturally sensitive, and non-judgemental conversation.
    Based on the details below, craft a first message (1-2 paragraphs) that:
    1. Acknowledges their specific problem and emotional state.
    2. Shares a brief, relatable struggle (real or fictional) to build rapport.
    3. Ends with an open-ended question to encourage the new mom to share more.
    Do NOT introduce yourself as an AI. Sign off simply as "Peer Mom."`;
    
    const userQuery = `My problem is: ${profileData.problem}. My mood is ${profileData.mood} and my health issue is ${profileData.health}. I want to talk to someone about: ${profileData.preference}`;
    
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    try {
        const result = await API.callGemini(API.GEMINI_URLS.flash, payload);
        const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "Hello. I am here to listen. Tell me more about your day.";
        
        chatHistory.push({ role: 'model', parts: [{ text: aiResponse }] });
        return aiResponse;

    } catch (error) {
        console.error("AI Chat Generation Error:", error);
        return "I understand you are having a tough time. It’s okay to feel this way. What is the one thing you wish someone could help you with right now?";
    }
}

async function sendSimulatedReply() {
    const replyContent = document.getElementById('chat-reply-content').value.trim();
    if (replyContent.length === 0) return;

    addMessageToChat('You', replyContent, false); 
    document.getElementById('chat-reply-content').value = '';
    
    await getAiChatReply(replyContent);
}

async function getAiChatReply(userMessage) {
    
    chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });

    addMessageToChat('Peer', '...', true);
    const chatContainer = document.getElementById('chat-container');
    const loadingMessage = chatContainer.lastElementChild;
    
    const systemPrompt = "You are an empathetic Peer Mom in an anonymous chat. Now, provide a short, supportive, and conversational reply (2-3 sentences max) to the user's latest message. Offer validation, a piece of simple advice, or ask a follow-up question. Do not introduce yourself or sign off. Keep the tone gentle.";
    
    const payload = {
        contents: chatHistory,
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    try {
        const result = await API.callGemini(API.GEMINI_URLS.flash, payload);
        
        const aiReply = result.candidates?.[0]?.content?.parts?.[0]?.text || "That sounds incredibly hard. I'm here for you.";

        loadingMessage.remove();
        addMessageToChat('Peer', aiReply, true);

        chatHistory.push({ role: 'model', parts: [{ text: aiReply }] });

    } catch (error) {
        console.error("AI Chat Reply Error:", error);
        loadingMessage.remove();
        addMessageToChat('Peer', 'Oops! The connection dropped. I still support you, though!', true);
    }
}

function addMessageToChat(sender, content, isPeer) {
    const chatContainer = document.getElementById('chat-container');
    
    const messageEl = document.createElement('div');
    messageEl.className = `p-3 rounded-xl max-w-[80%] ${isPeer ? 'self-start bg-gray-200 border border-gray-300' : 'self-end bg-deep-pink text-white shadow-lg'}`;
    
    messageEl.innerHTML = `
        <div class="text-xs font-semibold mb-1 ${isPeer ? 'text-gray-600' : 'text-pink-100'}">${isPeer ? 'Peer Mom' : 'You'}</div>
        <p class="whitespace-pre-wrap">${content}</p>
    `;

    chatContainer.appendChild(messageEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}
        
// --- START APPLICATION ---

// Make functions globally accessible for HTML onclick attributes
window.changeScreen = changeScreen;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handlePasswordReset = handlePasswordReset;
window.handleLogout = handleLogout;
window.saveUserProfile = saveUserProfile;
window.saveJournalEntry = saveJournalEntry;
window.generateCarePlan = generateCarePlan;
window.startPeerMatch = startPeerMatch;
window.sendSimulatedReply = sendSimulatedReply;
// Note: deleteJournalEntry is handled differently via event listeners

// Start the application
initializeAppAndAuth();
