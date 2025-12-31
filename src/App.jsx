import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  arrayUnion
} from "firebase/firestore";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut 
} from "firebase/auth";
import {
  getDatabase,
  ref,
  onValue,
  onDisconnect,
  set,
  serverTimestamp as rtdbTimestamp,
} from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyAT28Pp6okRvQTkTPU_0U6YzgG7dfHuO8g",
  authDomain: "my-chats-8ee7a.firebaseapp.com",
  projectId: "my-chats-8ee7a",
  storageBucket: "my-chats-8ee7a.appspot.com",
  messagingSenderId: "261728553193",
  appId: "1:261728553193:web:310489d953e557dcd88878",
  databaseURL: "https://my-chats-8ee7a-default-rtdb.asia-southeast1.firebasedatabase.app/",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const rtdb = getDatabase(app);

// --- Icons ---
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const TrashIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
const CheckIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>;
const DoubleCheckIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7M5 13l4 4L19 7"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 13l4 4L15 7"/></svg>;

// --- Encryption ---
async function deriveKey(pass, salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, baseKey, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}
function base64ToArrayBuffer(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary_string.charCodeAt(i);
  return bytes.buffer;
}
async function encryptMessage(txt, key) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(txt));
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return arrayBufferToBase64(combined.buffer);
}
async function decryptMessage(b64, key) {
  try {
    const combined = new Uint8Array(base64ToArrayBuffer(b64));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(dec);
  } catch { return "⚠️ Failed to decrypt"; }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("loading"); // loading | login | lobby | chat
  const [allUsers, setAllUsers] = useState([]);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [errorMsg, setErrorMsg] = useState("");
  
  // Chat State
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatPartner, setChatPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [cryptoKey, setCryptoKey] = useState(null);
  const [input, setInput] = useState("");
  
  // Selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMsgs, setSelectedMsgs] = useState(new Set());

  const messagesEndRef = useRef(null);

  // --- 1. Authentication ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Save user to Firestore
        try {
          const userRef = doc(db, "users", currentUser.uid);
          await setDoc(userRef, {
            uid: currentUser.uid,
            displayName: currentUser.displayName || "Anonymous",
            email: currentUser.email,
            photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName}`,
            lastSeen: serverTimestamp()
          }, { merge: true });
          
          setView("lobby");
        } catch (err) {
          console.error("Error saving user:", err);
          setErrorMsg("Database Permission Error. Check Firebase Rules.");
        }

        // Realtime Presence
        const rtdbStatusRef = ref(rtdb, `/status/${currentUser.uid}`);
        const isOffline = { state: 'offline', last_changed: rtdbTimestamp() };
        const isOnline = { state: 'online', last_changed: rtdbTimestamp() };
        
        const connectedRef = ref(rtdb, '.info/connected');
        onValue(connectedRef, (snap) => {
          if (snap.val() === true) {
            onDisconnect(rtdbStatusRef).set(isOffline).then(() => {
              set(rtdbStatusRef, isOnline);
            });
          }
        });
      } else {
        setUser(null);
        setView("login");
      }
    });
    return () => unsub();
  }, []);

  // --- 2. Fetch Users ---
  useEffect(() => {
    if (!user || view !== "lobby") return;

    const fetchUsers = async () => {
      try {
        const q = query(collection(db, "users"));
        const snap = await getDocs(q);
        const users = snap.docs.map(d => d.data()).filter(u => u.uid !== user.uid);
        setAllUsers(users);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    fetchUsers();

    const statusRef = ref(rtdb, '/status');
    return onValue(statusRef, (snap) => {
      setOnlineStatus(snap.val() || {});
    });
  }, [user, view]);

  // --- 3. Chat Logic ---
  const openChat = async (partner) => {
    setChatPartner(partner);
    const chatId = [user.uid, partner.uid].sort().join("_");
    setActiveChatId(chatId);
    
    // Derive Key from Chat ID (Unique per pair)
    const salt = new TextEncoder().encode(chatId);
    const key = await deriveKey(chatId, salt);
    setCryptoKey(key);
    
    setView("chat");
    setSelectionMode(false);
    setSelectedMsgs(new Set());
  };

  useEffect(() => {
    if (!activeChatId || !cryptoKey) return;
    
    const q = query(collection(db, "chats", activeChatId, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, async (snap) => {
      const msgs = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        let text = "";
        
        if (data.deleted === "everyone") {
          text = "🚫 This message was deleted";
        } else {
          text = await decryptMessage(data.text, cryptoKey);
        }

        return {
          id: d.id,
          ...data,
          text,
          timestamp: data.timestamp?.toDate()
        };
      }));
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsub();
  }, [activeChatId, cryptoKey]);

  // --- Actions ---
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      setErrorMsg("Google Login Failed. Enable Auth in Console.");
    }
  };

  const handleLogout = async () => {
    if (user) {
       const rtdbStatusRef = ref(rtdb, `/status/${user.uid}`);
       await set(rtdbStatusRef, { state: 'offline', last_changed: rtdbTimestamp() });
    }
    await signOut(auth);
    setView("login");
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !cryptoKey) return;
    
    const enc = await encryptMessage(input, cryptoKey);
    await addDoc(collection(db, "chats", activeChatId, "messages"), {
      text: enc,
      sender: user.uid,
      timestamp: serverTimestamp(),
      deleted: "none",
      hiddenBy: [] 
    });
    setInput("");
  };

  const toggleSelection = (msgId) => {
    const newSet = new Set(selectedMsgs);
    if (newSet.has(msgId)) newSet.delete(msgId);
    else newSet.add(msgId);
    
    setSelectedMsgs(newSet);
    setSelectionMode(newSet.size > 0);
  };

  const deleteSelected = async (type) => {
    const batchPromises = [];
    selectedMsgs.forEach(id => {
      const msgRef = doc(db, "chats", activeChatId, "messages", id);
      const msg = messages.find(m => m.id === id);
      
      if (!msg) return;

      if (type === 'everyone') {
        if (msg.sender === user.uid) {
           batchPromises.push(updateDoc(msgRef, { deleted: "everyone" }));
        }
      } else {
        batchPromises.push(updateDoc(msgRef, { hiddenBy: arrayUnion(user.uid) }));
      }
    });

    await Promise.all(batchPromises);
    setSelectionMode(false);
    setSelectedMsgs(new Set());
  };

  // --- Views ---

  if (view === "loading") {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
         <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (view === "login") {
    return (
      <div className="h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-teal-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-teal-500/20">
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Secure Chat</h1>
          <p className="text-slate-400 mb-8">WhatsApp-style encrypted messaging.</p>
          
          {errorMsg && <div className="mb-4 p-3 bg-red-500/20 text-red-300 text-sm rounded-lg border border-red-500/50">{errorMsg}</div>}

          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-3"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  if (view === "lobby") {
    return (
      <div className="h-screen bg-slate-900 flex flex-col">
        <header className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center sticky top-0 z-10">
           <div className="flex items-center gap-3">
             <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border-2 border-slate-600" />
             <div>
               <h2 className="text-white font-bold text-lg">Chats</h2>
               <p className="text-xs text-slate-400">{user.email}</p>
             </div>
           </div>
           <button onClick={handleLogout} className="text-slate-400 text-sm hover:text-white bg-slate-700 px-3 py-1.5 rounded-lg">
             Logout
           </button>
        </header>

        <div className="flex-1 overflow-y-auto p-2">
          {allUsers.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <p className="text-lg font-semibold">No contacts found</p>
                <p className="text-sm mt-2 max-w-xs text-center">Open this app in an <b>Incognito Window</b> and sign in with a <b>Different Google Account</b> to test the chat!</p>
             </div>
          ) : (
             allUsers.map(u => {
               const status = onlineStatus[u.uid];
               const isOnline = status?.state === 'online';
               
               return (
                 <div 
                    key={u.uid} 
                    onClick={() => openChat(u)}
                    className="flex items-center gap-4 p-4 hover:bg-slate-800 rounded-xl cursor-pointer transition border-b border-slate-800/50"
                 >
                   <div className="relative">
                     <img src={u.photoURL} className="w-12 h-12 rounded-full bg-slate-700 object-cover" />
                     {isOnline && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-slate-900 rounded-full"></span>}
                   </div>
                   <div className="flex-1">
                     <h3 className="text-slate-100 font-medium text-base">{u.displayName}</h3>
                     <p className="text-slate-400 text-sm">{isOnline ? "Online" : "Offline"}</p>
                   </div>
                 </div>
               );
             })
          )}
        </div>
      </div>
    );
  }

  // Chat View
  const partnerStatus = onlineStatus[chatPartner?.uid];
  const isPartnerOnline = partnerStatus?.state === 'online';

  return (
    <div className="h-screen bg-black flex flex-col relative">
       {/* Chat Header */}
       <header className={`p-3 flex items-center gap-3 border-b border-white/10 sticky top-0 z-20 transition-colors ${selectionMode ? 'bg-teal-900' : 'bg-slate-800'}`}>
         {selectionMode ? (
           <div className="flex-1 flex justify-between items-center text-white animate-fade-in">
              <div className="flex items-center gap-3">
                 <button onClick={() => {setSelectionMode(false); setSelectedMsgs(new Set());}} className="p-2 hover:bg-white/10 rounded-full">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                 </button>
                 <span className="font-bold">{selectedMsgs.size} selected</span>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => deleteSelected('me')} className="px-3 py-1.5 text-xs bg-white/20 rounded hover:bg-white/30">Delete for Me</button>
                 <button onClick={() => deleteSelected('everyone')} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700">Delete Everyone</button>
              </div>
           </div>
         ) : (
           <>
            <button onClick={() => setView("lobby")} className="text-slate-400 hover:text-white p-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div className="flex items-center gap-3 flex-1">
              <img src={chatPartner.photoURL} className="w-9 h-9 rounded-full bg-slate-700" />
              <div>
                <h3 className="text-white font-bold leading-tight">{chatPartner.displayName}</h3>
                <p className="text-xs text-slate-400">{isPartnerOnline ? <span className="text-green-400">Online</span> : "Offline"}</p>
              </div>
            </div>
           </>
         )}
       </header>

       {/* Messages */}
       <main className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-900">
         <AnimatePresence>
           {messages
             .filter(m => !m.hiddenBy?.includes(user.uid))
             .map((m) => {
               const isMe = m.sender === user.uid;
               const isSelected = selectedMsgs.has(m.id);
               
               return (
                 <motion.div
                   key={m.id}
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                 >
                   <div 
                      onClick={() => selectionMode ? toggleSelection(m.id) : null}
                      onContextMenu={(e) => { e.preventDefault(); toggleSelection(m.id); }}
                      className={`relative max-w-[80%] px-3 py-2 rounded-lg text-sm shadow-md cursor-pointer transition border
                        ${isSelected ? 'bg-teal-900/80 border-teal-500 ring-2 ring-teal-500' : 'border-transparent'}
                        ${isMe 
                          ? (m.deleted === "everyone" ? "bg-teal-900 text-slate-400 italic" : "bg-teal-700 text-white") 
                          : (m.deleted === "everyone" ? "bg-slate-800 text-slate-500 italic" : "bg-slate-800 text-slate-200")
                        }`}
                   >
                     {isSelected && (
                       <div className="absolute -right-2 -top-2 bg-teal-500 rounded-full p-0.5 border-2 border-black z-10">
                         <CheckIcon />
                       </div>
                     )}
                     <p className="whitespace-pre-wrap break-words">{m.text}</p>
                     <div className="flex items-center justify-end gap-1 mt-1">
                       <span className="text-[10px] opacity-60">
                         {m.timestamp?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </span>
                       {isMe && m.deleted !== "everyone" && (
                         <span className="opacity-80"><DoubleCheckIcon /></span>
                       )}
                     </div>
                   </div>
                 </motion.div>
               );
           })}
         </AnimatePresence>
         <div ref={messagesEndRef} />
       </main>

       {/* Input */}
       <footer className="p-3 bg-slate-800 border-t border-slate-700">
          <form onSubmit={sendMessage} className="flex gap-2 items-center">
            <input 
               value={input}
               onChange={e => setInput(e.target.value)}
               placeholder="Message"
               className="flex-1 bg-slate-900 text-white px-4 py-3 rounded-2xl focus:outline-none border border-slate-700 focus:border-teal-600 transition"
            />
            <button type="submit" disabled={!input.trim()} className="bg-teal-600 p-3 rounded-full text-white hover:bg-teal-500 transition disabled:opacity-50">
               <svg className="w-6 h-6 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
            </button>
          </form>
       </footer>
    </div>
  );
}