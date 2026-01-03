import React, { useState, useEffect } from "react";
import { getDatabase, ref, onValue, off } from "firebase/database";

export function UserStatus({ uid }) {
  const [status, setStatus] = useState(null);
  const db = getDatabase();

  useEffect(() => {
    if (!uid) return;

    // Listen to the specific user's status in Realtime DB
    const statusRef = ref(db, `status/${uid}`);

    const handleData = (snap) => {
      setStatus(snap.val());
    };

    onValue(statusRef, handleData);

    return () => off(statusRef, handleData);
  }, [uid]);

  // Helper to format time like WhatsApp (Today/Yesterday)
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    // Check if Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `last seen today at ${timeStr}`;
    if (isYesterday) return `last seen yesterday at ${timeStr}`;
    return `last seen ${date.toLocaleDateString()} at ${timeStr}`;
  };

  if (!status) return <span className="text-gray-400 text-xs">Offline</span>;

  if (status.state === "online") {
    return <span className="text-emerald-400 text-xs font-bold">Online</span>;
  }

  return (
    <span className="text-gray-500 text-[10px]">
      {formatTime(status.lastSeen)}
    </span>
  );
}