import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore'; // onSnapshot statt getDoc

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children, auth, db }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); 
  const [activeCompanyId, setActiveCompanyId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe = null;

    const authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // --- HIER IST DIE VERBESSERUNG ---
        // Wir hören live auf Änderungen am User-Dokument in der Datenbank
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        profileUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile(data);
            
            // Wenn der User eine CompanyId hat, setzen wir sie sofort
            // (Außer er ist SuperAdmin und hat manuell gewechselt, das ignorieren wir hier kurz der Einfachheit halber)
            // Für Mitarbeiter ist das hier perfekt:
            if (data.companyId) {
                setActiveCompanyId(data.companyId);
            }
          } else {
            // User ist im Auth, aber nicht in DB (sollte mit deinem Fix nicht mehr passieren)
            setUserProfile({ role: 'guest' });
            setActiveCompanyId(null);
          }
          setLoading(false); // Erst laden fertig melden, wenn Profil da ist
        }, (error) => {
          console.error("Fehler beim Laden des Profils:", error);
          setLoading(false);
        });

      } else {
        // Logout
        setUser(null);
        setUserProfile(null);
        setActiveCompanyId(null);
        setLoading(false);
        if (profileUnsubscribe) profileUnsubscribe();
      }
    });

    // Aufräumen beim Verlassen der Seite
    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, [auth, db]);

  const switchCompany = (companyId) => {
    if (userProfile?.role === 'super_admin') {
      setActiveCompanyId(companyId);
    }
  };

  const value = {
    user,
    userProfile,
    activeCompanyId,
    switchCompany,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};