# SheToMom: AI-Powered Postpartum Wellness App

**SheToMom** is a secure, AI-powered web application designed to support new mothers through their postpartum journey. It blends modern AI insights with traditional Indian Ayurvedic wisdom to provide a private, empathetic, and secure space for healing and connection.

The application is built with a modern, modular, and secure client-server architecture, ensuring that all sensitive API keys and user data are protected.

---

## ✨ Core Features

### **Secure Authentication**
Full user authentication system including sign-up, login, password reset, and logout, all powered by **Firebase Authentication**.

### **AI-Powered Care Plan**
Leverages **Google's Gemini AI** to provide personalized Ayurvedic care plans based on a user's journal entries or a custom query.  
The advice is structured around the three pillars of Ayurvedic healing:

- **Ahara (Diet & Food)**
- **Vihara (Body & Routine)**
- **Mana (Mind & Soul)**

### **Emotional AI Journal**
A private, personal journal for mothers to log their daily feelings. Each entry is analyzed by the Gemini AI to provide a simple, empathetic **"Mood"** and a supportive **"Insight."**

### **Anonymous Peer Connect (AI Simulation)**
A safe space for mothers to connect with a "peer" who is facing similar challenges. The peer is an **AI simulation**, providing supportive, anonymous, and judgment-free conversation.

### **Daily Wisdom**
A static resource page offering curated, expert-approved **Vedic and Ayurvedic advice** for postpartum recovery.

---

## 🔧 Tech Stack & Architecture

This project is built as a secure client-server application to protect all secret API keys.

### **Frontend (/frontend):**
- HTML5  
- Tailwind CSS  
- Modular JavaScript (ESM)

### **Backend (/backend):**
- Node.js  
- Express.js (for the server and API)  
- dotenv (for managing environment variables)  
- axios (for making secure API requests)

### **Services:**
- **Firebase Authentication:** Handles all user login and registration.  
- **Firestore Database:** Securely stores user profiles and private journal entries.  
- **Google Gemini API:** Powers all AI-driven features.

---

## 🔐 Secure by Design: The Proxy Model

The core of this architecture is **security**. The frontend (client) never holds any secret API keys.

### **Client (Frontend):**
The user interacts with the HTML/CSS/JS files in their browser.

### **Config Request:**
On load, the frontend asks our backend (`/api/config`) for the public Firebase configuration keys.

### **Proxy Server (Backend):**
The Node.js server has two jobs:

1. It serves the static frontend files to the user.  
2. It securely stores the **GEMINI_API_KEY** in a `.env` file (which is **not** on GitHub).

### **AI Request Flow:**
When the user requests an AI feature (like analyzing a journal entry):

1. The frontend sends the prompt (e.g., `"I feel tired"`) to our backend proxy (`/api/proxy`).  
2. The backend server receives this prompt, adds the secret Gemini API key to the request, and then forwards the complete, secure request to Google.  
3. Google sends the response back to our backend, which then sends it to the frontend.  

This prevents any keys from ever being exposed in the browser.

---

## 🚀 Local Setup & Installation

To run this project on your local machine, follow these steps.

---

### **1. Clone the Repository**

```bash
git clone [https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git)
cd YOUR_REPO_NAME
```

### **2. Set Up the Backend**
The backend server is responsible for serving the app and managing all API keys.

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Install all required Node.js packages
npm install

# 3. Create your secret environment file
# (This is the most important step)
touch .env
```
## 3. Configure Environment Variables

Open the new `backend/.env` file you just created and paste in the following, filling in your own secret keys.

```bash
# --- Your Gemini API Key ---
GEMINI_API_KEY="AIzaSy...YOUR_GEMINI_KEY...0n8"

# --- Your Firebase Config Keys ---
# Find these in your Firebase Project Settings
FB_API_KEY="AIzaSy...YOUR_FIREBASE_KEY...ZzQ"
FB_AUTH_DOMAIN="shetomom-project.firebaseapp.com"
FB_PROJECT_ID="shetomom-project"
FB_STORAGE_BUCKET="shetomom-project.firebasestorage.app"
FB_MESSAGING_SENDER_ID="190274063011"
FB_APP_ID="1:190274063011:web:2fb00b7a197ced4d4a0d16"
FB_MEASUREMENT_ID="G-M5NF55LY03"

```

## 4. Set Up Firebase Project

If you haven't already, you must configure your Firebase project.

### 🧩 Create Project
Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.

### 🔐 Enable Authentication
In the **Build → Authentication** section, click **"Get Started"** and enable the **Email/Password** sign-in provider.

### 💾 Create Firestore Database
In the **Build → Firestore Database** section, click **"Create database."**  
Start in **Test Mode** (we will secure it next).

---

### ⚠️ CRITICAL: Set Firestore Rules

Go to the **Rules** tab in Firestore and replace all existing text with the following rules.  
This ensures users can only read and write their own data.  
Click **Publish** when done.

```bash
rules_version = '2';
service cloud.firestore 
{
  match /databases/{database}/documents 
  {

    // Rule 1: Allow users to read and write their OWN profile.
    match /users/{userId}/profile/main 
    {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Rule 2: Allow users to manage their OWN journals.
    match /users/{userId}/journals/{journalId} 
    {
      allow read, write, delete: if request.auth != null && request.auth.uid == userId;
    }

  }
}

```

## 5. Run the Application

You are now ready to start the server.

### 🖥️ 1. Make sure you are in the `/backend` directory
```bash
cd /path/to/YOUR_REPO_NAME/backend
```

### 🚀 2. Start the Server

Run the following command to start the backend server:

```bash
npm start
```
**You should see output similar to:**

Server running on port 3000
Serving frontend from ../frontend directory


## ☁️ Deployment to Render (Live on the Web)

This project is configured to be deployed easily on **Render** for free.

---

### 🧭 1. Push to GitHub
Make sure your entire project (including the **backend/server.js** modifications and the root **.gitignore** file) is pushed to a **GitHub repository**.  

> ⚠️ **Do NOT push your `.env` file.**

---

### 🚀 2. Create Render Web Service
1. Sign up for [Render](https://render.com/) and connect your **GitHub account**.  
2. On the **Dashboard**, click **New + → Web Service**.  
3. Select your **project repository**.

### 3. Configure Render Settings

* **Name:** `shetomom` (or your choice)
* **Root Directory:** `backend` (This tells Render to run `npm` commands inside your `/backend` folder).
* **Environment:** `Node`
* **Build Command:** `npm install`
* **Start Command:** `npm start` (This will run `node server.js` as defined in your `package.json`).

### 4. Add Environment Variables (The Final Step)

1.  Go to the **Environment** tab for your new service.
2.  Under **Environment Variables**, click **Add Environment Variable**.
3.  Manually add all 8 keys from your local `.env` file:
    * `GEMINI_API_KEY`
    * `FB_API_KEY`
    * `FB_AUTH_DOMAIN`
    * `FB_PROJECT_ID`
    * `FB_STORAGE_BUCKET`
    * `FB_MESSAGING_SENDER_ID`
    * `FB_APP_ID`
    * `FB_MEASUREMENT_ID`
4.  You can also add:
    * `NODE_VERSION=18.17.0`

### 5. Deploy

1.  Click **Create Web Service**.
2.  Render will automatically build and deploy your app using the new environment variables.
3.  Once **Live**, your app will be available at the public URL, for example:
    `https://shetomom.onrender.com`
