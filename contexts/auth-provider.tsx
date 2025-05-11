"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

type UserDetails = {
  id: string;
  email: string;
  role: string;
  profileCompleted: boolean;
  name?: string;
  phone?: string;
};

type AuthContextType = {
  user: User | null;
  userDetails: UserDetails | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUserDetails: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchUserDetails(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role, profile_completed, name, phone')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        setUserDetails({
          id: data.id,
          email: data.email,
          role: data.role,
          profileCompleted: data.profile_completed,
          name: data.name,
          phone: data.phone,
        });
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  }

  async function refreshUserDetails() {
    if (user) {
      await fetchUserDetails(user.id);
    }
  }

  useEffect(() => {
    async function initAuth() {
      setLoading(true);
      
      // Check if there's an active session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        await fetchUserDetails(session.user.id);
      }
      
      // Listen for auth changes
      const { data: { subscription } } = await supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (session?.user) {
            setUser(session.user);
            await fetchUserDetails(session.user.id);
          } else {
            setUser(null);
            setUserDetails(null);
          }
        }
      );
      
      setLoading(false);
      
      // Cleanup
      return () => {
        subscription.unsubscribe();
      };
    }
    
    initAuth();
  }, []);
  
  async function signOut() {
    await supabase.auth.signOut();
  }
  
  const value = {
    user,
    userDetails,
    loading,
    signOut,
    refreshUserDetails,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
