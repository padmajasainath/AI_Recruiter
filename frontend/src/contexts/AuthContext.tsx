'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    User,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api } from '@/lib/api';

interface AuthContextType {
    user: User | null;
    companyData: any | null;
    loading: boolean;
    signIn: () => Promise<void>;
    signInWithEmail: (email: string, pass: string) => Promise<void>;
    signUpWithEmail: (email: string, pass: string) => Promise<void>;
    signOut: () => Promise<void>;
    registerCompany: (data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [companyData, setCompanyData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                try {
                    const data = await api.getMe();
                    setCompanyData(data);
                } catch {
                    setCompanyData(null);
                }
            } else {
                setCompanyData(null);
            }
            setLoading(false);
        });
        return unsub;
    }, []);

    const signIn = async () => {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    };

    const signInWithEmail = async (email: string, pass: string) => {
        await signInWithEmailAndPassword(auth, email, pass);
    };

    const signUpWithEmail = async (email: string, pass: string) => {
        await createUserWithEmailAndPassword(auth, email, pass);
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
        setCompanyData(null);
    };

    const registerCompany = async (data: any) => {
        const result = await api.registerCompany(data);
        setCompanyData(result);
    };

    return (
        <AuthContext.Provider value={{
            user,
            companyData,
            loading,
            signIn,
            signInWithEmail,
            signUpWithEmail,
            signOut,
            registerCompany
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
