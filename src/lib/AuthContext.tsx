import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signingIn: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const profileDoc = await getDoc(doc(db, 'users', user.uid));
        if (profileDoc.exists()) {
          setProfile(profileDoc.data() as UserProfile);
        } else {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      // Check if profile exists, if not, wait for role selection or create default
      const profileDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!profileDoc.exists()) {
        // We'll let the UI handle role selection if profile doesn't exist
      } else {
        setProfile(profileDoc.data() as UserProfile);
      }
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // Expected user actions or environment cleanup - don't log as error
        console.log('Sign in cancelled');
      } else {
        console.error('Sign in error', error);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateRole = async (role: UserRole) => {
    if (!user) return;
    const newProfile: Partial<UserProfile> = {
      uid: user.uid,
      email: user.email!,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      role,
      createdAt: serverTimestamp() as any,
    };
    await setDoc(doc(db, 'users', user.uid), newProfile);
    setProfile(newProfile as UserProfile);
    
    // If barber, initialize barber profile too
    if (role === 'barber') {
      const defaultWorkingHours = {
        monday: { start: '09:00', end: '17:00', enabled: true },
        tuesday: { start: '09:00', end: '17:00', enabled: true },
        wednesday: { start: '09:00', end: '17:00', enabled: true },
        thursday: { start: '09:00', end: '17:00', enabled: true },
        friday: { start: '09:00', end: '17:00', enabled: true },
        saturday: { start: '10:00', end: '14:00', enabled: true },
        sunday: { start: '10:00', end: '14:00', enabled: false },
      };
      await setDoc(doc(db, 'barbers', user.uid), {
        userId: user.uid,
        available: true,
        rating: 5,
        reviewCount: 0,
        specialties: ['Classic Cut'],
        bio: 'Expert barber from TrimTime',
        workingHours: defaultWorkingHours,
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signingIn, signIn, logout, updateRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
