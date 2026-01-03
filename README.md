<div align="center">

  <img src="public/icons/icon-512.webp" alt="Secure Chat Logo" width="140" />

  # 🔐 Secure Chat

  **The Future of Private, Real-time Communication.**
  
  *Built for privacy. Designed for speed. Styled for the modern web.*

  <p>
    <a href="YOUR_DEPLOYED_LINK_HERE" target="_blank">
      <img src="https://img.shields.io/badge/LIVE_DEMO-FF0055?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" />
    </a>
  </p>

  <p>
    <a href="#-features">Features</a> •
    <a href="#-tech-stack">Tech Stack</a> •
    <a href="#-getting-started">Run Locally</a> •
    <a href="#-gallery">Gallery</a>
  </p>

  ![React](https://img.shields.io/badge/React-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
  ![Firebase](https://img.shields.io/badge/firebase-%23039BE5.svg?style=for-the-badge&logo=firebase)
  ![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
  ![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)

</div>

---

## 🚀 Overview

**Secure Chat** isn't just another messaging app; it is a fortress for your data wrapped in a stunning **Glassmorphism UI**.

We leverage **AES-GCM encryption** to ensure your messages are locked before they ever leave your device. Whether you are chatting globally, using our one-time **Secret Rooms**, or tracking presence with millisecond precision, Secure Chat offers a fluid, premium experience that rivals native applications.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **🔐 Military-Grade Security** | End-to-End Encryption using the Web Crypto API. Server admins cannot read your messages. |
| **⚡ Blazing Fast Sync** | Powered by **Firebase Realtime Database & Firestore** for sub-100ms latency. |
| **🟢 True Presence** | Smart detection handles tab switching, internet loss, and backgrounding instantly. |
| **🎨 Cosmic Aesthetics** | A deep, dark-mode-first UI featuring glassmorphism, blurs, and **Framer Motion** animations. |
| **🕵️ Secret Ops** | Generate 6-digit **Secret Room** codes for temporary, history-free encrypted sessions. |
| **📱 Native Feel** | Fully PWA compliant and mobile-optimized via **Capacitor**. |

---

## 📸 Gallery

<div align="center" id="-gallery">
  <table style="border: none;">
    <tr>
      <td align="center" style="border: none;">
        <img src="screenshots/welcome.png" width="250" alt="Login Screen" style="border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);" />
        <br />
        <sub><b>✨ Fluid Onboarding</b></sub>
      </td>
      <td align="center" style="border: none;">
        <img src="screenshots/dashboard.png" width="250" alt="Lobby" style="border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);" />
        <br />
        <sub><b>🌍 Global Lobby</b></sub>
      </td>
      <td align="center" style="border: none;">
        <img src="screenshots/interface.png" width="250" alt="Chat UI" style="border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);" />
        <br />
        <sub><b>💬 Encrypted Chat</b></sub>
      </td>
    </tr>
    <tr>
      <td align="center" style="border: none;">
        <img src="screenshots/options.png" width="250" alt="Smart Inbox" style="border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);" />
        <br />
        <sub><b>📬 Smart Drawer</b></sub>
      </td>
      <td align="center" style="border: none;">
        <img src="screenshots/profile.png" width="250" alt="Profile" style="border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);" />
        <br />
        <sub><b>👤 Identity Control</b></sub>
      </td>
      <td align="center" style="border: none;">
      </td>
    </tr>
  </table>
</div>

---

## 🛠 Tech Stack

### **Core**
* **Framework:** [React 18](https://reactjs.org/)
* **Build Tool:** [Vite](https://vitejs.dev/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)

### **Backend & Services**
* **Auth & DB:** Google Firebase (Auth, Firestore, Realtime DB)
* **Encryption:** Web Crypto API (SubtleCrypto)

---

## 💻 Getting Started (Run Locally)

If you want to run this project locally, you will need to provide your own Firebase credentials.

1. **Clone the repository**
   ```bash
   git clone [https://github.com/your-username/secure-chat.git](https://github.com/your-username/secure-chat.git)
   cd secure-chat
   npm install
