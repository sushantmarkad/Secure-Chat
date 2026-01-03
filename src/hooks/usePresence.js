import { useEffect } from "react";
import { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp } from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export function usePresence() {
  useEffect(() => {
    const auth = getAuth();
    const db = getDatabase();

    // 1. Wait for the user to be logged in
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      const userStatusRef = ref(db, `/status/${user.uid}`);
      const connectedRef = ref(db, ".info/connected");

      // 2. Listen to the specialized ".info/connected" path
      const unsubscribeConnected = onValue(connectedRef, (snap) => {
        // If snapshot is false, we are disconnected locally
        if (snap.val() === false) {
          return;
        }

        // 3. We are connected! 
        // A. Tell Firebase Server: "If I disconnect later, set me to offline"
        onDisconnect(userStatusRef).set({
          state: "offline",
          lastSeen: serverTimestamp(),
        }).then(() => {
          // B. Set me to online NOW
          set(userStatusRef, {
            state: "online",
            lastSeen: serverTimestamp(),
          });
        });
      });

      // 4. Handle Tab Switching / Mobile Background
      // If user minimizes app, set to offline immediately (Like WhatsApp)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          set(userStatusRef, {
            state: "offline",
            lastSeen: serverTimestamp(),
          });
        } else {
          set(userStatusRef, {
            state: "online",
            lastSeen: serverTimestamp(),
          });
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
}