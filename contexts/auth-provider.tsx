"use client";

import React, { createContext, useContext, useState } from 'react';

// 基本的なユーザー型定義
type User = {
  id: number;
  email: string;
  role: string;
};

type UserDetails = {
  firstName?: string;
  lastName?: string;
  role?: string;
};

// AuthContextの型定義
type AuthContextType = {
  user: User | null;
  userDetails: UserDetails | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUserDetails: () => Promise<void>;
};

// デフォルト値を持つコンテキストを作成
export const AuthContext = createContext<AuthContextType>({
  user: null,
  userDetails: null,
  loading: false,
  signOut: async () => {},
  refreshUserDetails: async () => {},
});

// AuthProviderコンポーネント
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // ログアウト関数
  const signOut = async () => {
    // メンテナンスモードなので実際の処理は省略
    setUser(null);
    setUserDetails(null);
  };

  // ユーザー詳細を更新する関数
  const refreshUserDetails = async () => {
    // メンテナンスモードなので実際の処理は省略
    setLoading(true);
    try {
      // 実際はAPIからデータを取得
    } catch (error) {
      console.error('Failed to refresh user details:', error);
    } finally {
      setLoading(false);
    }
  };

  // コンテキスト値の作成
  const value = {
    user,
    userDetails,
    loading,
    signOut,
    refreshUserDetails,
  };

  // AuthContextのプロバイダーを返す
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// AuthContextを使用するためのカスタムフック
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}
