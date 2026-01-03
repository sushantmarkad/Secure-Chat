import React, { useState, useEffect, useRef } from "react";
import SignIn from "./SignIn";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  arrayUnion,
  getDoc
} from "firebase/firestore";
import { 
  getAuth, 
  onAuthStateChanged, 
  signOut,
  updateProfile 
} from "firebase/auth";
import {
  getDatabase,
  ref,
  onValue,
  onDisconnect,
  set,
  off,
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

// --- NEW: Presence Hook ---
const usePresence = () => {
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      const userStatusRef = ref(rtdb, `/status/${user.uid}`);
      const connectedRef = ref(rtdb, ".info/connected");

      const unsubscribeConnected = onValue(connectedRef, (snap) => {
        if (snap.val() === false) return;

        onDisconnect(userStatusRef).set({
          state: "offline",
          lastSeen: rtdbTimestamp(),
        }).then(() => {
          set(userStatusRef, {
            state: "online",
            lastSeen: rtdbTimestamp(),
          });
        });
      });

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          set(userStatusRef, { state: "offline", lastSeen: rtdbTimestamp() });
        } else {
          set(userStatusRef, { state: "online", lastSeen: rtdbTimestamp() });
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        unsubscribeConnected();
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    });

    return () => unsubscribeAuth();
  }, []);
};

// --- NEW: UserStatus Component ---
const UserStatus = ({ uid }) => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!uid) return;
    const statusRef = ref(rtdb, `status/${uid}`);
    const handleData = (snap) => setStatus(snap.val());
    onValue(statusRef, handleData);
    return () => off(statusRef, handleData);
  }, [uid]);

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `last seen today at ${timeStr}`;
    if (isYesterday) return `last seen yesterday at ${timeStr}`;
    return `last seen ${date.toLocaleDateString()} at ${timeStr}`;
  };

  if (!status) return <span className="text-white/30 text-[10px]">Offline</span>;

  if (status.state === "online") {
    return <span className="text-emerald-400 text-xs font-bold animate-pulse">Online</span>;
  }

  return (
    <span className="text-white/40 text-[10px]">
      {formatTime(status.lastSeen)}
    </span>
  );
};

// --- NEW: Copyright Component ---
const Copyright = () => (
  <div className="py-4 text-center w-full">
    <p className="text-[10px] text-white/20 uppercase tracking-widest font-medium">
      &copy; {new Date().getFullYear()} Sushant Markad
    </p>
    <p className="text-[9px] text-white/10 mt-0.5">All Rights Reserved</p>
  </div>
);

// --- Encryption Utilities ---
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
  } catch { return "🔒 Encrypted"; }
}

// --- Icons ---
const SendIcon = () => <svg className="w-6 h-6 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>;
const BackIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>;
const CheckIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>;
const DoubleCheckIcon = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7M5 13l4 4L19 7"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 13l4 4L15 7"/></svg>;
const CopyIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>;
const LockIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>;
const EditIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>;
const ChatIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>;
const InboxIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>;
const CloseIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>;

const ScreenWrapper = ({ children }) => (
  <div className="h-[100dvh] w-full bg-[#0a0a0a] text-white flex flex-col relative overflow-hidden font-sans">
    <div className="absolute top-0 left-0 w-full h-full z-0 overflow-hidden pointer-events-none">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/30 rounded-full blur-[100px] animate-blob"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
    </div>
    <div className="relative z-10 w-full h-full flex flex-col">
      {children}
    </div>
  </div>
);

export default function App() {
  usePresence();

  const [user, setUser] = useState(null);
  const [view, setView] = useState("loading"); 
  const [allUsers, setAllUsers] = useState([]);
  const [inboxChats, setInboxChats] = useState([]);
  const [showInbox, setShowInbox] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [errorMsg, setErrorMsg] = useState("");
  
  const [profileData, setProfileData] = useState({
    displayName: "",
    gender: "",
    age: "",
    interests: "",
    lookingFor: "",
    isPublic: true
  });
  
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatPartner, setChatPartner] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [isRoomMode, setIsRoomMode] = useState(false);
  const [messages, setMessages] = useState([]);
  const [cryptoKey, setCryptoKey] = useState(null);
  const [input, setInput] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMsgs, setSelectedMsgs] = useState(new Set());

  const messagesEndRef = useRef(null);

  // --- 1. Authentication ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setView("lobby");

        try {
          const userRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(userRef);
          
          if (docSnap.exists()) {
             const data = docSnap.data();
             setProfileData({
               displayName: data.displayName || "",
               gender: data.gender || "", 
               age: data.age || "",
               interests: data.interests || "",
               lookingFor: data.lookingFor || "",
               isPublic: data.isPublic !== undefined ? data.isPublic : true
             });
          }

          setDoc(userRef, { 
            lastSeen: serverTimestamp(),
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName || "User",
            photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=random`
          }, { merge: true });

        } catch (err) {
          console.error("Error fetching user data:", err);
        }
      } else {
        setUser(null);
        setView("login");
      }
    });
    return () => unsub();
  }, []);

  // --- 2. Fetch Data (Realtime) ---
  useEffect(() => {
    if (!user || view !== "lobby") return;

    const qUsers = query(collection(db, "users"));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const users = snap.docs
        .map(d => d.data())
        .filter(u => u.uid !== user.uid && (u.isPublic === true || u.isPublic === undefined));
      setAllUsers(users);
    });

    const qInbox = query(
      collection(db, "chats"), 
      where("participants", "array-contains", user.uid),
      orderBy("timestamp", "desc")
    );
    const unsubInbox = onSnapshot(qInbox, (snap) => {
      const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setInboxChats(chats);
    });

    const statusRef = ref(rtdb, '/status');
    const unsubStatus = onValue(statusRef, (snap) => {
      setOnlineStatus(snap.val() || {});
    });

    return () => {
      unsubUsers();
      unsubInbox();
      unsubStatus();
    };
  }, [user, view]);

  // --- 3. Chat Logic ---
  const openDirectChat = async (partner) => {
    setChatPartner(partner);
    setRoomCode(null);
    setIsRoomMode(false);
    setShowInbox(false); 
    
    const chatId = [user.uid, partner.uid].sort().join("_");
    setActiveChatId(chatId);
    
    const salt = new TextEncoder().encode(chatId);
    const key = await deriveKey(chatId, salt);
    setCryptoKey(key);
    
    setView("chat");
    setSelectionMode(false);
    setSelectedMsgs(new Set());
  };

  const enterRoom = async (code) => {
    if(!code || code.length < 3) return;
    setChatPartner(null);
    setRoomCode(code);
    setIsRoomMode(true);
    setShowInbox(false);
    
    const chatId = `room_${code}`;
    setActiveChatId(chatId);
    
    const salt = new TextEncoder().encode(chatId);
    const key = await deriveKey(chatId, salt);
    setCryptoKey(key);
    
    setView("chat");
    setSelectionMode(false);
    setSelectedMsgs(new Set());
    setJoinCodeInput("");
  };

  const createRoom = () => {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    enterRoom(newCode);
  };

  useEffect(() => {
    if (!activeChatId || !cryptoKey) return;
    
    const q = query(collection(db, "chats", activeChatId, "messages"), orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, async (snap) => {
      const msgs = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data();
        let text = "";
        
        if (data.deleted === "everyone") {
          text = "🚫 Message deleted";
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

  const handleLogout = async () => {
    if (user) {
       const rtdbStatusRef = ref(rtdb, `/status/${user.uid}`);
       set(rtdbStatusRef, { state: 'offline', last_changed: rtdbTimestamp() })
        .catch(err => console.log("Offline status failed, ignoring:", err));
    }
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error", error);
    }
    setUser(null);
    setView("login");
  };

  const getAvatarUrl = (g, name) => {
    const seed = name.replace(/\s/g, '');
    if (g === "Male") return `https://avatar.iran.liara.run/public/boy?username=${seed}`;
    if (g === "Female") return `https://avatar.iran.liara.run/public/girl?username=${seed}`;
    return `https://ui-avatars.com/api/?name=${name}&background=random`;
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      const userRef = doc(db, "users", user.uid);
      const newPhotoURL = getAvatarUrl(profileData.gender, profileData.displayName);

      await updateDoc(userRef, {
        displayName: profileData.displayName,
        gender: profileData.gender,
        age: profileData.age,
        interests: profileData.interests,
        lookingFor: profileData.lookingFor,
        isPublic: profileData.isPublic,
        photoURL: newPhotoURL 
      });
      
      await updateProfile(user, { 
        displayName: profileData.displayName,
        photoURL: newPhotoURL 
      });

      alert("Profile Updated!");
      setView("lobby");
    } catch (err) {
      console.error("Error updating profile:", err);
      setErrorMsg("Failed to update profile.");
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !cryptoKey) return;
    
    const enc = await encryptMessage(input, cryptoKey);
    const timestamp = serverTimestamp();

    if (!isRoomMode && chatPartner) {
        try {
          const chatDocRef = doc(db, "chats", activeChatId);
          await setDoc(chatDocRef, {
              participants: [user.uid, chatPartner.uid],
              lastSender: user.uid,
              timestamp: timestamp,
              lastMessagePreview: "Encrypted Message" 
          }, { merge: true });
        } catch (err) {
          console.warn("Inbox update failed (check rules):", err);
        }
    }

    try {
      await addDoc(collection(db, "chats", activeChatId, "messages"), {
        text: enc,
        sender: user.uid,
        displayName: user.displayName,
        timestamp: timestamp,
        deleted: "none",
        hiddenBy: [] 
      });
      setInput("");
    } catch (err) {
      console.error("Message send failed:", err);
      alert("Failed to send. Check internet or permissions.");
    }
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

  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      alert("Code copied!");
    }
  };

  // --- VIEWS ---

  if (view === "loading") {
    return (
      <ScreenWrapper>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-white/50 text-sm tracking-widest uppercase">Initializing Secure Link</p>
        </div>
      </ScreenWrapper>
    );
  }

  if (view === "login") {
    return (
      <ScreenWrapper>
         <SignIn auth={auth} db={db} />
         <div className="absolute bottom-4 left-0 w-full pointer-events-none">
            <Copyright />
         </div>
      </ScreenWrapper>
    );
  }

  if (view === "profile") {
    return (
      <ScreenWrapper>
        <header className="px-6 py-5 flex items-center gap-3 bg-black/20 backdrop-blur-md sticky top-0 z-20 border-b border-white/5">
           <button onClick={() => setView("lobby")} className="text-white/70 hover:text-white p-1">
              <BackIcon />
           </button>
           <h2 className="text-lg font-bold text-white">Edit Profile</h2>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSaveProfile} className="max-w-md mx-auto space-y-5">
            <div className="flex justify-center mb-6">
               <img src={user.photoURL} className="w-24 h-24 rounded-full border-4 border-indigo-500/30 bg-slate-800" />
            </div>

            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between">
               <div>
                  <h4 className="text-white font-semibold">Public Profile</h4>
                  <p className="text-xs text-white/50">Show my profile in Global Chats list</p>
               </div>
               <div 
                  onClick={() => setProfileData({...profileData, isPublic: !profileData.isPublic})}
                  className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors duration-300 ${profileData.isPublic ? 'bg-emerald-500' : 'bg-slate-600'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-md transform duration-300 ${profileData.isPublic ? 'translate-x-5' : ''}`}></div>
               </div>
            </div>

            <div className="space-y-1">
               <label className="text-xs text-white/50 uppercase tracking-widest pl-1">Full Name</label>
               <input 
                 value={profileData.displayName}
                 onChange={e => setProfileData({...profileData, displayName: e.target.value})}
                 className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:border-indigo-500 focus:outline-none"
               />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <label className="text-xs text-white/50 uppercase tracking-widest pl-1">Age</label>
                 <input 
                   type="number"
                   value={profileData.age}
                   onChange={e => setProfileData({...profileData, age: e.target.value})}
                   className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:border-indigo-500 focus:outline-none"
                 />
              </div>
              <div className="space-y-1">
                 <label className="text-xs text-white/50 uppercase tracking-widest pl-1">Gender</label>
                 <select 
                   value={profileData.gender}
                   onChange={e => setProfileData({...profileData, gender: e.target.value})}
                   className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:border-indigo-500 focus:outline-none appearance-none"
                 >
                   <option value="Male" className="bg-slate-900">Male</option>
                   <option value="Female" className="bg-slate-900">Female</option>
                   <option value="Other" className="bg-slate-900">Other</option>
                 </select>
              </div>
            </div>

            <div className="space-y-1">
               <label className="text-xs text-white/50 uppercase tracking-widest pl-1">Interests</label>
               <input 
                 placeholder="Coding, Music, Travel..."
                 value={profileData.interests}
                 onChange={e => setProfileData({...profileData, interests: e.target.value})}
                 className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:border-indigo-500 focus:outline-none"
               />
            </div>

            <div className="space-y-1">
               <label className="text-xs text-white/50 uppercase tracking-widest pl-1">Looking For</label>
               <select 
                   value={profileData.lookingFor}
                   onChange={e => setProfileData({...profileData, lookingFor: e.target.value})}
                   className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white focus:border-indigo-500 focus:outline-none appearance-none"
                 >
                   <option value="" className="bg-slate-900">Select Option</option>
                   <option value="Friendship" className="bg-slate-900">Friendship</option>
                   <option value="Networking" className="bg-slate-900">Networking</option>
                   <option value="Chat" className="bg-slate-900">Just Chat</option>
                   <option value="Relationship" className="bg-slate-900">Relationship</option>
                 </select>
            </div>

            <button 
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition shadow-lg shadow-indigo-600/20 mt-4"
            >
              Save Profile
            </button>
            <div className="mt-4 pb-4">
               <Copyright />
            </div>
          </form>
        </div>
      </ScreenWrapper>
    );
  }

  if (view === "lobby") {
    return (
      <ScreenWrapper>
        <header className="px-6 py-5 flex justify-between items-center bg-black/20 backdrop-blur-xl sticky top-0 z-20 border-b border-white/5">
           <div className="flex items-center gap-3">
             <div className="relative">
                <img src={user.photoURL} alt="Me" className="w-10 h-10 rounded-full border border-white/20 bg-slate-800" />
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-black rounded-full"></div>
             </div>
             <div onClick={() => setView('profile')} className="cursor-pointer group">
               <div className="flex items-center gap-2">
                 <h2 className="text-lg font-bold text-white group-hover:text-indigo-400 transition">{user.displayName?.split(' ')[0]}</h2>
                 <EditIcon />
               </div>
               <p className="text-[10px] text-white/40 uppercase tracking-wider">Tap name to edit</p>
             </div>
           </div>
           <button onClick={handleLogout} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition text-white/60 hover:text-white">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
           </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8 relative">
          
          <section>
            <div className="relative overflow-hidden rounded-3xl p-6 border border-indigo-500/30 shadow-[0_8px_30px_rgba(79,70,229,0.15)] bg-gradient-to-br from-indigo-900/60 to-purple-900/60 backdrop-blur-md">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/30 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                     <LockIcon />
                  </div>
                  <h3 className="text-xl font-bold text-white">Secret Room</h3>
                </div>
                <p className="text-indigo-200/70 text-sm mb-6 leading-relaxed">
                  Join a secure, temporary encrypted channel with a friend using a shared code.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                   <button onClick={createRoom} className="flex-1 bg-white text-indigo-900 hover:bg-indigo-50 font-bold py-3.5 px-4 rounded-xl transition shadow-lg flex items-center justify-center gap-2">
                     <span>Create New Room</span>
                   </button>
                   <div className="flex-1 flex flex-col sm:flex-row gap-2">
                      <input value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} placeholder="Enter Code" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-center text-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none placeholder:text-white/20 transition" />
                      <button onClick={() => enterRoom(joinCodeInput)} disabled={joinCodeInput.length < 3} className="bg-indigo-600/50 hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-indigo-600/50 text-white px-4 py-3 rounded-xl transition border border-white/10 flex items-center justify-center">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
                      </button>
                   </div>
                </div>
              </div>
            </div>
          </section>

          <section>
             <div className="flex items-center gap-2 mb-4 px-1">
                <ChatIcon />
                <h3 className="text-lg font-bold text-white">Global Chats</h3>
                <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full text-white/60">{allUsers.length}</span>
             </div>
             
             <div className="bg-white/5 border border-white/5 rounded-3xl p-2 backdrop-blur-sm min-h-[200px] mb-20">
                {allUsers.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-48 text-white/30 text-center p-6">
                      <p className="text-sm">No public users found.</p>
                      <p className="text-xs mt-1 opacity-50">Users with "Private Profile" won't appear here.</p>
                   </div>
                ) : (
                   <div className="space-y-1">
                     {allUsers.map(u => {
                       const status = onlineStatus[u.uid];
                       const isOnline = status?.state === 'online';
                       return (
                         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={u.uid} onClick={() => openDirectChat(u)} className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-white/10 cursor-pointer transition-all border border-transparent hover:border-white/5">
                           <div className="relative">
                             <img src={u.photoURL} className="w-12 h-12 rounded-full object-cover bg-slate-800" />
                             {isOnline ? (
                               <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#121212] rounded-full"></span>
                             ) : (
                               <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-zinc-500 border-2 border-[#121212] rounded-full"></span>
                             )}
                           </div>
                           <div className="flex-1 min-w-0">
                             <h3 className="text-white font-semibold truncate group-hover:text-indigo-300 transition">{u.displayName}</h3>
                             <div className="flex items-center gap-2 text-xs text-white/40 truncate">
                                 {isOnline ? <span className="text-emerald-400 font-medium">Online</span> : <span>Offline • Click to chat</span>}
                                 {u.age && <span>• {u.age} y/o</span>}
                             </div>
                           </div>
                           <div className="text-white/20 group-hover:text-white/60">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                           </div>
                         </motion.div>
                       );
                     })}
                   </div>
                )}
             </div>
          </section>

          <AnimatePresence>
            {showInbox && (
              <>
                 <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setShowInbox(false)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                 />
                 <motion.div 
                    initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed bottom-0 left-0 right-0 h-[80dvh] bg-[#121212] border-t border-white/10 rounded-t-3xl z-50 flex flex-col shadow-2xl"
                 >
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20 rounded-t-3xl">
                       <h2 className="text-lg font-bold text-white flex items-center gap-2">
                          <InboxIcon /> Inbox
                       </h2>
                       <button onClick={() => setShowInbox(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
                          <CloseIcon />
                       </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                       {inboxChats.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-white/30 text-center">
                             <p>No recent conversations.</p>
                          </div>
                       ) : (
                          inboxChats.map(chat => {
                            const otherUid = chat.participants.find(uid => uid !== user.uid);
                            const otherUser = allUsers.find(u => u.uid === otherUid) || { displayName: "Unknown", uid: otherUid, photoURL: "" };
                            const lastTime = chat.timestamp?.toDate();
                            
                            return (
                               <div key={chat.id} onClick={() => openDirectChat(otherUser)} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer transition">
                                  <img src={otherUser.photoURL || `https://ui-avatars.com/api/?name=${otherUser.displayName}`} className="w-12 h-12 rounded-full object-cover bg-slate-800" />
                                  <div className="flex-1 min-w-0">
                                     <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="text-white font-semibold truncate">{otherUser.displayName}</h3>
                                        {lastTime && <span className="text-[10px] text-white/40">{lastTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                     </div>
                                     <p className="text-xs text-white/50 truncate italic">
                                        {chat.lastSender === user.uid ? "You: " : ""}{chat.lastMessagePreview || "Encrypted Message"}
                                     </p>
                                  </div>
                               </div>
                            );
                          })
                       )}
                    </div>
                 </motion.div>
              </>
            )}
          </AnimatePresence>

        </div>

        <motion.button 
           initial={{ scale: 0 }} animate={{ scale: 1 }}
           onClick={() => setShowInbox(true)}
           className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/40 text-white hover:bg-indigo-500 transition z-30"
        >
           <InboxIcon />
           {inboxChats.length > 0 && (
             <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-[#0a0a0a]"></span>
           )}
        </motion.button>
      </ScreenWrapper>
    );
  }

  const partnerStatus = !isRoomMode ? onlineStatus[chatPartner?.uid] : null;
  const isPartnerOnline = partnerStatus?.state === 'online';

  return (
    <ScreenWrapper>
       <header className={`px-4 py-3 flex items-center gap-3 backdrop-blur-xl border-b border-white/10 sticky top-0 z-30 transition-colors duration-300 ${selectionMode ? 'bg-indigo-900/80' : 'bg-black/20'}`}>
         {selectionMode ? (
           <div className="flex-1 flex justify-between items-center text-white animate-fade-in">
              <div className="flex items-center gap-3">
                 <button onClick={() => {setSelectionMode(false); setSelectedMsgs(new Set());}} className="p-2 hover:bg-white/10 rounded-full">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                 </button>
                 <span className="font-semibold text-sm">{selectedMsgs.size} selected</span>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => deleteSelected('me')} className="px-3 py-1.5 text-xs font-medium bg-white/10 rounded-lg hover:bg-white/20 backdrop-blur-md">For Me</button>
                 <button onClick={() => deleteSelected('everyone')} className="px-3 py-1.5 text-xs font-medium bg-red-500/80 text-white rounded-lg hover:bg-red-500 backdrop-blur-md shadow-lg shadow-red-500/20">Everyone</button>
              </div>
           </div>
         ) : (
           <>
            <button onClick={() => setView("lobby")} className="text-white/70 hover:text-white p-2 -ml-2 rounded-full hover:bg-white/5 transition">
              <BackIcon />
            </button>
            
            {isRoomMode ? (
              <div className="flex items-center gap-3 flex-1 overflow-hidden">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                    <LockIcon />
                 </div>
                 <div className="flex-1">
                   <h3 className="text-white font-bold text-sm leading-tight">Secret Room</h3>
                   <div className="flex items-center gap-2">
                      <p className="text-[10px] text-emerald-400 font-mono tracking-wider">CODE: {roomCode}</p>
                      <button onClick={copyRoomCode} className="text-white/40 hover:text-white">
                         <CopyIcon />
                      </button>
                   </div>
                 </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-1 overflow-hidden">
                <div className="relative">
                  <img src={chatPartner?.photoURL} className="w-10 h-10 rounded-full bg-white/10" />
                  {isPartnerOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-black rounded-full"></span>}
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm leading-tight truncate">{chatPartner?.displayName}</h3>
                  <UserStatus uid={chatPartner?.uid} />
                </div>
              </div>
            )}
           </>
         )}
       </header>

       <main className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
         <div className="flex justify-center my-4">
            <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] text-white/30 uppercase tracking-widest border border-white/5">
              Messages are End-to-End Encrypted
            </span>
         </div>
         
         <AnimatePresence>
           {messages
             .filter(m => !m.hiddenBy?.includes(user.uid))
             .map((m) => {
               const isMe = m.sender === user.uid;
               const isSelected = selectedMsgs.has(m.id);
               
               return (
                 <motion.div
                   key={m.id}
                   initial={{ opacity: 0, scale: 0.95, y: 10 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   className={`flex w-full flex-col ${isMe ? "items-end" : "items-start"}`}
                 >
                   {isRoomMode && !isMe && (
                     <span className="text-[10px] text-white/40 mb-1 ml-1">{m.displayName || "Unknown"}</span>
                   )}
                   
                   <div 
                      onClick={() => selectionMode ? toggleSelection(m.id) : null}
                      onContextMenu={(e) => { e.preventDefault(); toggleSelection(m.id); }}
                      className={`relative max-w-[85%] sm:max-w-[70%] px-4 py-2.5 text-sm shadow-sm cursor-pointer transition-all duration-200
                        ${isSelected ? 'ring-2 ring-indigo-500 scale-[0.98]' : ''}
                        ${isMe 
                          ? (m.deleted === "everyone" 
                              ? "bg-indigo-900/30 border border-indigo-500/30 text-white/50 italic rounded-2xl rounded-tr-sm" 
                              : "bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl rounded-tr-sm shadow-[0_4px_15px_rgba(79,70,229,0.3)]") 
                          : (m.deleted === "everyone" 
                              ? "bg-white/5 border border-white/10 text-white/40 italic rounded-2xl rounded-tl-sm" 
                              : "bg-[#1f1f1f] text-white/90 border border-white/5 rounded-2xl rounded-tl-sm")
                        }`}
                   >
                     {isSelected && (
                       <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-indigo-400">
                         <CheckIcon />
                       </div>
                     )}
                     
                     <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
                     
                     <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-white/60' : 'text-white/40'}`}>
                       <span>
                         {m.timestamp?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </span>
                       {isMe && m.deleted !== "everyone" && (
                         <span><DoubleCheckIcon /></span>
                       )}
                     </div>
                   </div>
                 </motion.div>
               );
           })}
         </AnimatePresence>
         <div ref={messagesEndRef} />
       </main>

       <footer className="p-3 bg-black/40 backdrop-blur-md border-t border-white/10 pb-6 sm:pb-3">
          <form onSubmit={sendMessage} className="flex gap-2 items-end max-w-4xl mx-auto">
            <div className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-2xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all flex items-center">
              <input 
                 value={input}
                 onChange={e => setInput(e.target.value)}
                 placeholder="Type a secure message..."
                 className="w-full bg-transparent text-white px-4 py-3.5 focus:outline-none placeholder:text-white/20"
              />
            </div>
            <button 
              type="submit" 
              disabled={!input.trim()} 
              className="bg-indigo-600 p-3.5 rounded-xl text-white hover:bg-indigo-500 transition active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-indigo-600/20"
            >
               <SendIcon />
            </button>
          </form>
       </footer>
    </ScreenWrapper>
  );
}