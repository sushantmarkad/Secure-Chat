// App.jsx
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
  updateDoc,
} from "firebase/firestore"; // Added doc and updateDoc
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getDatabase,
  ref,
  onValue,
  onDisconnect,
  set,
  serverTimestamp as rtdbTimestamp,
} from "firebase/database";
import { motion } from "framer-motion"; // Added for swipe animation

// Firebase setup (unchanged)
const firebaseConfig = {
  apiKey: "AIzaSyAT28Pp6okRvQTkTPU_0U6YzgG7dfHuO8g",
  authDomain: "my-chats-8ee7a.firebaseapp.com",
  projectId: "my-chats-8ee7a",
  storageBucket: "my-chats-8ee7a.appspot.com",
  messagingSenderId: "261728553193",
  appId: "1:261728553193:web:310489d953e557dcd88878",
  databaseURL:
    "https://my-chats-8ee7a-default-rtdb.asia-southeast1.firebasedatabase.app/",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const rtdb = getDatabase(app);

// ---- Encryption helpers (unchanged) ----
function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
async function deriveKey(pass, salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(pass),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}
async function encryptMessage(txt, key) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(txt)
  );
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
  } catch {
    return "⚠️ Failed to decrypt";
  }
}

// ---- Helper: Icon Components ----
const CheckIcon = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const DoubleCheckIcon = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M5 13l4 4L19 7"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M1 13l4 4L15 7"
    />
  </svg>
);

export default function App() {
  // --- Original State ---
  const [userId, setUserId] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [username, setUsername] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [cryptoKey, setCryptoKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [someoneTyping, setSomeoneTyping] = useState(false);
  const inputRef = useRef(null);
  const unsubscribeRef = useRef(null);
  const messagesEndRef = useRef(null);

  // --- New State for Features ---
  const [selectedMessage, setSelectedMessage] = useState(null); // For context menu
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 }); // Menu position
  const [replyingTo, setReplyingTo] = useState(null); // For reply feature
  const [locallyDeletedIds, setLocallyDeletedIds] = useState(new Set()); // For "Delete for me"
  const isUpdatingSeen = useRef(false); // To prevent read-receipt loops

  // --- Added state: swipe & UI helpers ---
  const [swipeStartX, setSwipeStartX] = useState(null);
  const mainRef = useRef(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState(null); // { online: bool, lastSeen: timestamp, username }

  // --- Viewport Height Fix (unchanged) ---
  useEffect(() => {
    const updateVh = () =>
      document.documentElement.style.setProperty(
        "--vh",
        `${window.innerHeight * 0.01}px`
      );
    updateVh();
    window.addEventListener("resize", updateVh);
    return () => window.removeEventListener("resize", updateVh);
  }, []);

  // --- Firebase Auth (unchanged) ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) setUserId(user.uid);
      else await signInAnonymously(auth);
      setLoading(false);
    });
    return unsub;
  }, []);

  // --- Join Room (unchanged) ---
  const joinRoom = async (e) => {
    e.preventDefault();
    if (!roomCode.trim() || !username.trim()) return;
    setIsJoining(true);
    const salt = new TextEncoder().encode(roomCode);
    const key = await deriveKey(roomCode, salt);
    setCryptoKey(key);
    setTimeout(() => {
      setInRoom(true);
      setIsJoining(false);
      setTimeout(() => inputRef.current?.focus(), 300);
    }, 350);
  };

  // --- Listen Messages (Updated) ---
  useEffect(() => {
    if (!inRoom || !cryptoKey) return;
    const encoded = encodeURIComponent(btoa(roomCode));
    const col = collection(db, "secure-rooms", encoded, "messages");
    const q = query(col, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(q, async (snap) => {
      // First pass: decrypt all messages
      const decryptedMsgs = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const text = await decryptMessage(data.text, cryptoKey);
          return {
            id: d.id,
            text,
            sender: data.sender,
            username: data.username,
            timestamp: data.timestamp?.toDate?.() ?? null,
            replyToId: data.replyToId || null,
            replyToSender: data.replyToSender || null,
            deleted: data.deleted || "none",
            seenBy: data.seenBy || [],
          };
        })
      );

      // Second pass: link replies to their original message
      const finalMsgs = decryptedMsgs.map((m) => {
        if (m.replyToId) {
          const originalMsg = decryptedMsgs.find((o) => o.id === m.replyToId);
          if (originalMsg && originalMsg.deleted !== "everyone") {
            m.replyTo = {
              text: originalMsg.text,
              sender: originalMsg.username,
            };
          } else {
            // Original message not found or is deleted
            m.replyTo = {
              text: "Original message was deleted",
              sender: m.replyToSender || "Unknown",
            };
          }
        }
        return m;
      });

      setMessages(finalMsgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });

    unsubscribeRef.current = unsub;
    return () => unsub();
  }, [inRoom, cryptoKey, roomCode]);

  // --- New Effect: Update Read Receipts ---
  useEffect(() => {
    if (!inRoom || !cryptoKey || !userId || !messages.length) return;
    if (isUpdatingSeen.current) return;

    const encoded = encodeURIComponent(btoa(roomCode));
    const unreadMessages = messages.filter(
      (m) => m.sender !== userId && !m.seenBy.includes(userId)
    );

    if (unreadMessages.length > 0) {
      isUpdatingSeen.current = true;
      const updates = unreadMessages.map((msg) => {
        const docRef = doc(db, "secure-rooms", encoded, "messages", msg.id);
        // Get the most up-to-date 'seenBy' array from the message object
        const currentSeenBy =
          messages.find((m) => m.id === msg.id)?.seenBy || [];
        return updateDoc(docRef, {
          seenBy: [...currentSeenBy, userId],
        });
      });

      Promise.all(updates)
        .catch((err) => console.error("Error updating seen status:", err))
        .finally(() => {
          isUpdatingSeen.current = false;
        });
    }
  }, [messages, inRoom, cryptoKey, userId, roomCode]);

  // --- Typing Indicator (unchanged) ---
  useEffect(() => {
    if (!roomCode) return;
    const typingRef = ref(rtdb, `typing/${roomCode}`);
    const unsub = onValue(typingRef, (snap) => {
      const data = snap.val() || {};
      const others = Object.values(data).filter(
        (t) => t.username !== username && t.typing
      );
      setSomeoneTyping(others.length > 0);
    });
    return () => unsub();
  }, [roomCode, username]);

  const handleTyping = () => {
    if (!roomCode || !userId) return;
    const typingRef = ref(rtdb, `typing/${roomCode}/${userId}`);
    set(typingRef, { username, typing: true });
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      set(typingRef, { username, typing: false });
    }, 1500);
  };

  // --- Send Message (Updated) ---
  const sendMsg = async (e) => {
    e.preventDefault();
    if (!input.trim() || !cryptoKey) return;
    const enc = await encryptMessage(input, cryptoKey);
    const encoded = encodeURIComponent(btoa(roomCode));

    await addDoc(collection(db, "secure-rooms", encoded, "messages"), {
      text: enc,
      sender: userId,
      username,
      timestamp: serverTimestamp(),
      // Add new fields
      replyToId: replyingTo ? replyingTo.id : null,
      replyToSender: replyingTo ? replyingTo.username : null,
      deleted: "none",
      seenBy: [userId], // Sender always sees their own message
    });

    setInput("");
    setReplyingTo(null); // Clear reply state
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // --- Leave Room (unchanged) ---
  const leaveRoom = async () => {
    setIsLeaving(true);
    try {
      if (userId) {
        const userStatusRef = ref(rtdb, `/status/${userId}`);
        await onDisconnect(userStatusRef).cancel();
        await set(userStatusRef, {
          username,
          roomCode,
          online: false,
          lastSeen: rtdbTimestamp(),
        });
      }
      if (unsubscribeRef.current) unsubscribeRef.current();

      setTimeout(() => {
        setInRoom(false);
        setCryptoKey(null);
        setMessages([]);
        setRoomCode("");
        setUsername("");
        setIsLeaving(false);
      }, 400);
    } catch {
      setInRoom(false);
      setIsLeaving(false);
    }
  };

  // --- New Handlers for Context Menu ---
  const handleLongPress = (e, message) => {
    e.preventDefault();
    if (message.deleted === "everyone") return; // Don't show menu for deleted
    setSelectedMessage(message);
    // Constrain menu to viewport
    const x = Math.min(e.clientX, window.innerWidth - 180); // 180px menu width
    const y = Math.min(e.clientY, window.innerHeight - 200); // 200px menu height
    setModalPosition({ x, y });
  };

  const closeContextMenu = () => {
    setSelectedMessage(null);
  };

  // keep handleReply (not used in long-press)
  const handleReply = () => {
    if (selectedMessage) {
      setReplyingTo(selectedMessage);
      closeContextMenu();
      inputRef.current?.focus();
    }
  };

  const handleDeleteForMe = () => {
    if (!selectedMessage) return;
    setLocallyDeletedIds(new Set(locallyDeletedIds).add(selectedMessage.id));
    closeContextMenu();
  };

  const handleDeleteForEveryone = async () => {
    if (!selectedMessage || !cryptoKey) return;
    const encoded = encodeURIComponent(btoa(roomCode));
    const docRef = doc(
      db,
      "secure-rooms",
      encoded,
      "messages",
      selectedMessage.id
    );

    try {
      // Encrypt a "deleted" placeholder to maintain encryption
      const deletedText = "This message was deleted";
      const encDeletedText = await encryptMessage(deletedText, cryptoKey);

      await updateDoc(docRef, {
        text: encDeletedText,
        deleted: "everyone",
        replyToId: null, // Clear reply info
        replyToSender: null,
      });
    } catch (err) {
      console.error("Error deleting for everyone:", err);
    }
    closeContextMenu();
  };

  // --- Swipe to Reply Handlers (added) ---
  const handleTouchStart = (e) => {
    setSwipeStartX(e.touches ? e.touches[0].clientX : null);
  };

  const handleTouchMove = (e, message) => {
    if (swipeStartX === null) return;
    const currentX = e.touches ? e.touches[0].clientX : null;
    if (currentX === null) return;
    const deltaX = currentX - swipeStartX;
    if (deltaX > 70) {
      setReplyingTo(message);
      setSwipeStartX(null);
    }
  };

  const handleTouchEnd = () => {
    setSwipeStartX(null);
  };

  // --- Scroll handler for showing scroll-to-bottom button ---
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollDown(distanceFromBottom > 150);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollDown(false);
  };

  // --- Partner presence: listen to /status and show other's online/lastSeen ---
  useEffect(() => {
    if (!inRoom || !userId || !roomCode) {
      setPartnerStatus(null);
      return;
    }
    const statusRef = ref(rtdb, "/status");
    const unsub = onValue(statusRef, (snap) => {
      const data = snap.val() || {};
      // find other user in same room (room is shared by only 2 users)
      let found = null;
      Object.entries(data).forEach(([key, val]) => {
        if (
          key !== userId &&
          val &&
          val.roomCode === roomCode // same room
        ) {
          found = { id: key, username: val.username, online: !!val.online, lastSeen: val.lastSeen || null };
        }
      });
      setPartnerStatus(found);
    });
    return () => unsub();
  }, [inRoom, userId, roomCode]);

  // --- Update our own status presence on join/leave (keeps existing behavior) ---
  useEffect(() => {
    if (!inRoom || !userId) return;
    // set ourselves online in /status
    const userStatusRef = ref(rtdb, `/status/${userId}`);
    set(userStatusRef, { username, roomCode, online: true, lastSeen: null });

    // set onDisconnect to set offline + lastSeen
    onDisconnect(userStatusRef)
      .set({ username, roomCode, online: false, lastSeen: rtdbTimestamp() })
      .catch((err) => {
        // on some environments, onDisconnect requires established connection
        console.warn("onDisconnect setup failed:", err);
      });

    return () => {
      // mark offline when leaving the room in leaveRoom as well
      // (leaveRoom sets it too), but also set here on unmount
      set(userStatusRef, { username, roomCode, online: false, lastSeen: rtdbTimestamp() }).catch(() => { });
    };
  }, [inRoom, userId, username, roomCode]);

  // --- Send message via keyboard enter handled earlier ---

  // --- UI (unchanged wrapper) ---

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="animate-spin h-16 w-16 border-t-2 border-b-2 border-teal-500 rounded-full"></div>
      </div>
    );

  if (!inRoom)
    return (
      <div
        className={`flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 to-black p-4 font-sans transition-all duration-500 transform ${isLeaving
            ? "opacity-0 scale-95"
            : isJoining
              ? "opacity-0 scale-95"
              : "opacity-100 scale-100"
          }`}
      >
        <div className="w-full max-w-sm text-center space-y-6">
          <h1 className="text-5xl font-bold text-white transition-all duration-500">
            Secure Chat
          </h1>
          <p className="text-gray-400">Enter a room code and name to begin.</p>

          <form
            onSubmit={joinRoom}
            className="space-y-6 bg-gray-800 bg-opacity-50 backdrop-blur-md rounded-2xl shadow-2xl p-8 transition-transform duration-500 hover:scale-[1.01]"
          >
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Enter Room Code"
              className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-center transition"
            />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter Your Name"
              className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-center transition"
            />
            <button
              type="submit"
              className="w-full px-4 py-3 bg-teal-600 hover:bg-teal-700 rounded-lg text-white font-semibold transition"
            >
              Join Room
            </button>
          </form>
        </div>
      </div>
    );

  // --- Main Chat UI (Updated) ---
  return (
    <div
      className={`flex flex-col bg-gray-900 text-white transition-all duration-500 transform ${isLeaving ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
      style={{ height: "calc(var(--vh, 1vh) * 100)" }}
      onClick={() => {
        if (selectedMessage) closeContextMenu();
      }} // Click anywhere to close modal
    >
      <header className="sticky top-0 flex flex-col bg-gray-800 p-3 shadow z-20">
        <div className="flex items-center justify-between">
          <button
            onClick={leaveRoom}
            className="text-teal-400 hover:text-teal-300 px-2 py-1 transition"
          >
            ← Leave
          </button>
          <h2 className="text-gray-400 text-sm font-mono">{roomCode}</h2>
          <div className="w-10" />
        </div>

        {/* Partner online / last seen */}
        <div className="mt-1">
          {partnerStatus ? (
            partnerStatus.online ? (
              <div className="text-xs text-teal-300">Online</div>
            ) : partnerStatus.lastSeen ? (
              <div className="text-xs text-gray-400">
                Last seen{" "}
                {(() => {
                  try {
                    const d = new Date(partnerStatus.lastSeen);
                    return d.toLocaleString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "short",
                    });
                  } catch {
                    return "some time ago";
                  }
                })()}
              </div>
            ) : (
              <div className="text-xs text-gray-400">Offline</div>
            )
          ) : (
            <div className="text-xs text-gray-500">—</div>
          )}
        </div>
      </header>

      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 scroll-smooth"
      >
        {messages
          .filter((m) => !locallyDeletedIds.has(m.id)) // Filter locally deleted
          .map((m) => {
            // Check for deleted status
            if (m.deleted === "everyone") {
              return (
                <div
                  key={m.id}
                  className={`flex animate-slideIn ${m.sender === userId ? "justify-end" : "justify-start"
                    }`}
                >
                  <div
                    className="px-4 py-3 rounded-2xl bg-gray-700 italic text-gray-400 text-sm"
                  >
                    {m.sender === userId
                      ? "You deleted this message"
                      : "This message was deleted"}
                  </div>
                </div>
              );
            }

            // --- Render Normal Message ---
            // We use motion.div to allow dragging for swipe-to-reply
            return (
              <div
                key={m.id}
                className={`flex flex-col animate-slideIn ${m.sender === userId ? "items-end" : "items-start"
                  }`}
              >
                <motion.div
                  onContextMenu={(e) => handleLongPress(e, m)}
                  onTouchStart={handleTouchStart}
                  onTouchMove={(e) => handleTouchMove(e, m)}
                  onTouchEnd={handleTouchEnd}
                  drag="x"
                  dragConstraints={{ left: 0, right: 80 }}
                  dragElastic={0.02} // faster, tighter drag
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 65) setReplyingTo(m); // slightly more sensitive
                  }}
                  whileTap={{ scale: 0.98 }}
                  transition={{
                    type: "spring",
                    stiffness: 800, // higher = snappier
                    damping: 22,    // lower = less sluggish, quick settle
                    mass: 0.6,      // reduces lag on start
                  }}
                  className={`relative px-4 py-3 rounded-2xl shadow-sm max-w-xs md:max-w-md ${m.sender === userId
                      ? "bg-teal-700 hover:bg-teal-600"
                      : "bg-gray-700 hover:bg-gray-600"
                    } transition cursor-pointer select-none`}
                >

                  {/* --- New: Render Reply Box --- */}
                  {m.replyTo && (
                    <div className="p-2 bg-black bg-opacity-20 rounded-lg mb-2 border-l-2 border-teal-400">
                      <p className="font-bold text-teal-300 text-sm">
                        {m.replyTo.sender}
                      </p>
                      <p className="text-gray-200 text-sm opacity-80 truncate">
                        {m.replyTo.text}
                      </p>
                    </div>
                  )}

                  {/* --- Original Message Text --- */}
                  <p className="break-words" style={{ whiteSpace: "pre-wrap" }}>
                    {m.text}
                  </p>

                  {/* --- Timestamp and Read Receipt --- */}
                  {m.timestamp && (
                    <div className="flex items-center justify-end gap-1 text-gray-300 mt-1 text-right">
                      <span className="text-[10px]">
                        {m.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {/* --- New: Render Ticks --- */}
                      {m.sender === userId && (
                        <span>
                          {m.seenBy.length > 1 ? (
                            <DoubleCheckIcon className="w-4 h-4 text-blue-400" />
                          ) : (
                            <CheckIcon className="w-4 h-4 text-gray-400" />
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              </div>
            );
          })}
        {someoneTyping && (
          <div className="text-xs text-teal-400 text-center animate-pulse">
            Someone is typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* --- New: Context Menu Modal (Reply removed from long-press) --- */}
      {selectedMessage && (
        <div
          className="fixed z-50 bg-gray-700 rounded-lg shadow-xl w-44 animate-slideIn"
          style={{ top: `${modalPosition.y}px`, left: `${modalPosition.x}px` }}
          onClick={(e) => e.stopPropagation()} // Prevent click-through
        >
          <ul className="text-sm text-white">
            <li
              className="p-3 hover:bg-gray-600 cursor-pointer"
              onClick={handleDeleteForMe}
            >
              Delete for me
            </li>
            {/* Only show "Delete for everyone" if user is the sender */}
            {selectedMessage.sender === userId && (
              <li
                className="p-3 hover:bg-gray-600 cursor-pointer text-red-400"
                onClick={handleDeleteForEveryone}
              >
                Delete for everyone
              </li>
            )}
            <li
              className="p-3 hover:bg-gray-600 cursor-pointer border-t border-gray-600 rounded-b-lg"
              onClick={closeContextMenu}
            >
              Cancel
            </li>
          </ul>
        </div>
      )}

      {/* --- Footer (Updated) --- */}
      <footer className="sticky bottom-0 bg-gray-800 shadow-inner z-10">
        {/* --- New: Reply Preview Box --- */}
        {replyingTo && (
          <div className="flex items-center justify-between p-3 bg-gray-700 border-b border-gray-900 animate-slideIn">
            <div className="flex-1 overflow-hidden">
              <p className="font-bold text-teal-300 text-sm">
                Replying to {replyingTo.username}
              </p>
              <p className="text-gray-200 text-sm opacity-80 truncate">
                {replyingTo.text}
              </p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-2 text-gray-400 hover:text-white"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* --- Original Form --- */}
        <form onSubmit={sendMsg} className="flex gap-3 p-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleTyping();
            }}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
          />
          <button
            type="submit"
            className="w-12 h-12 bg-teal-600 hover:bg-teal-700 rounded-full flex items-center justify-center transition"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </form>
      </footer>

      {/* --- Floating Scroll-to-bottom button --- */}
      {showScrollDown && (
        <button
          onClick={scrollToBottom}
          className="fixed right-4 bottom-28 z-40 bg-teal-600 hover:bg-teal-700 text-white rounded-full p-3 shadow-lg"
          aria-label="Scroll to bottom"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
