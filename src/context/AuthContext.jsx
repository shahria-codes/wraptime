import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  firebaseSignOut, 
  onAuthStateChanged,
  db,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  getDocs,
  query,
  where
} from '../firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubscribeProfile = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setError(null);

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);

        // Listen for profile changes in real-time
        unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          } else {
            // First user to sign in automatically becomes the initial Manager!
            let initialRole = 'employee';
            let initialStatus = 'pending';

            try {
              const q = query(collection(db, 'users'), where('role', '==', 'manager'));
              const querySnap = await getDocs(q);
              if (querySnap.empty) {
                initialRole = 'manager';
                initialStatus = 'authorized';
              }
            } catch (e) {
              console.warn('Firestore manager lookup on bootstrap:', e);
            }

            const newProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Employee',
              photoURL: currentUser.photoURL || '',
              role: initialRole,
              status: initialStatus,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            await setDoc(userRef, newProfile);
            setUserProfile(newProfile);
          }
          setLoading(false);
        }, (err) => {
          console.error('Error fetching user profile:', err);
          setLoading(false);
        });
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Google Sign In Error:", err);
      setError(err.message || 'Google Sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const promoteToManager = async (targetUid) => {
    if (targetUid) {
      const userRef = doc(db, 'users', targetUid);
      await setDoc(userRef, { 
        role: 'manager', 
        status: 'authorized', 
        updatedAt: new Date().toISOString() 
      }, { merge: true });
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      error,
      loginWithGoogle,
      logout,
      promoteToManager
    }}>
      {children}
    </AuthContext.Provider>
  );
};
