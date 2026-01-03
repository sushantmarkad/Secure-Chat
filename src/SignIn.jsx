import React, { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  signInWithPopup, 
  GoogleAuthProvider 
} from "firebase/auth";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { motion } from "framer-motion";

// Icons
const GoogleIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" fillOpacity="0.5"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" fillOpacity="0.5"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" fillOpacity="0.5"/></svg>;
const LockIcon = () => <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>;

export default function SignIn({ auth, db }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("Male");
  const [age, setAge] = useState("");
  const [interests, setInterests] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Helper to get Avatar based on Gender
  const getAvatarUrl = (g, name) => {
    const seed = name.replace(/\s/g, '');
    if (g === "Male") return `https://avatar.iran.liara.run/public/boy?username=${seed}`;
    if (g === "Female") return `https://avatar.iran.liara.run/public/girl?username=${seed}`;
    return `https://ui-avatars.com/api/?name=${name}&background=random`;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      if (isLogin) {
        // --- LOGIN ---
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // --- SIGN UP ---
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Generate Avatar URL
        const photoURL = getAvatarUrl(gender, fullName);

        // Update Auth Profile
        await updateProfile(user, { 
          displayName: fullName,
          photoURL: photoURL 
        });

        // Save ALL Details to Firestore
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: fullName,
          photoURL: photoURL,
          gender: gender,
          age: age,
          interests: interests,
          lookingFor: lookingFor,
          isPublic: isPublic,
          lastSeen: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message.replace("Firebase:", "").trim());
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          gender: "Other", // Default for Google
          age: "",
          interests: "",
          lookingFor: "",
          isPublic: true,
          lastSeen: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("Google Login Failed.");
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto custom-scrollbar">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl my-auto"
      >
        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-indigo-500/20">
           <LockIcon />
        </div>
        
        <h1 className="text-2xl font-bold text-center text-white mb-6">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h1>
        
        {errorMsg && <div className="mb-4 p-3 bg-red-500/20 text-red-200 text-xs rounded-lg border border-red-500/20 text-center">{errorMsg}</div>}

        <form onSubmit={handleAuth} className="space-y-3">
          
          {/* Sign Up Fields */}
          {!isLogin && (
            <div className="space-y-3 animate-fade-in">
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 p-3 rounded-xl text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none transition"
                />

                <div className="flex gap-3">
                    <input 
                      type="number" 
                      placeholder="Age" 
                      required
                      value={age}
                      onChange={e => setAge(e.target.value)}
                      className="w-1/3 bg-black/20 border border-white/10 p-3 rounded-xl text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none transition"
                    />
                    <div className="relative flex-1">
                       <select
                         value={gender}
                         onChange={(e) => setGender(e.target.value)}
                         className="w-full bg-black/20 border border-white/10 p-3 rounded-xl text-white focus:border-indigo-500 focus:outline-none appearance-none"
                       >
                         <option value="Male" className="bg-slate-900">Male</option>
                         <option value="Female" className="bg-slate-900">Female</option>
                         <option value="Other" className="bg-slate-900">Other</option>
                       </select>
                    </div>
                </div>

                <input 
                  type="text" 
                  placeholder="Interests (e.g. Coding, Music)" 
                  value={interests}
                  onChange={e => setInterests(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 p-3 rounded-xl text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none transition"
                />

                <div className="relative">
                   <select
                     value={lookingFor}
                     onChange={(e) => setLookingFor(e.target.value)}
                     className="w-full bg-black/20 border border-white/10 p-3 rounded-xl text-white focus:border-indigo-500 focus:outline-none appearance-none"
                   >
                     <option value="" className="bg-slate-900 text-white/50">Looking For...</option>
                     <option value="Friendship" className="bg-slate-900">Friendship</option>
                     <option value="Networking" className="bg-slate-900">Networking</option>
                     <option value="Chat" className="bg-slate-900">Just Chat</option>
                     <option value="Relationship" className="bg-slate-900">Relationship</option>
                   </select>
                </div>
            </div>
          )}
          
          {/* Common Fields */}
          <input 
             type="email" 
             placeholder="Email Address" 
             required
             value={email}
             onChange={e => setEmail(e.target.value)}
             className="w-full bg-black/20 border border-white/10 p-3 rounded-xl text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none transition"
          />
          <input 
             type="password" 
             placeholder="Password" 
             required
             value={password}
             onChange={e => setPassword(e.target.value)}
             className="w-full bg-black/20 border border-white/10 p-3 rounded-xl text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none transition"
          />

          {!isLogin && (
            <div className="flex items-center gap-3 px-1 py-2">
              <div 
                onClick={() => setIsPublic(!isPublic)}
                className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 ${isPublic ? 'bg-emerald-500' : 'bg-slate-600'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform duration-300 ${isPublic ? 'translate-x-4' : ''}`}></div>
              </div>
              <span className="text-sm text-white/70">
                {isPublic ? "Public Profile (Visible)" : "Private Profile (Hidden)"}
              </span>
            </div>
          )}
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg shadow-indigo-600/20 mt-4 disabled:opacity-50"
          >
            {loading ? "Processing..." : (isLogin ? "Sign In" : "Sign Up")}
          </button>
        </form>

        <div className="flex items-center gap-4 my-6">
           <div className="h-px bg-white/10 flex-1"></div>
           <span className="text-xs text-white/40">OR</span>
           <div className="h-px bg-white/10 flex-1"></div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          className="w-full bg-white text-black font-semibold py-3 px-4 rounded-xl hover:bg-gray-100 transition flex items-center justify-center gap-3"
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>

        <p className="text-center text-xs text-white/40 mt-6">
          {isLogin ? "Don't have an account?" : "Already have an account?"} 
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-indigo-400 hover:text-indigo-300 ml-1 font-semibold"
          >
            {isLogin ? "Sign Up" : "Log In"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}