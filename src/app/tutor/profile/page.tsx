
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Supabaseクライアントの設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// テーブル名
const TABLE_NAME = 'tutor_profiles';

export default function TutorProfilePage() {
  const [profile, setProfile] = useState({
    name: '',
    bio: '',
    subjects: '',
    // 他の必要なフィールド
  });
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [existingProfile, setExistingProfile] = useState(null);

  // セッションチェック関数
  const checkSession = async () => {
    try {
      // セッション情報を取得するためのダイレクトなHTTPリクエスト
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey
        }
      });
      
      if (!response.ok) {
        console.warn('セッション確認に失敗:', response.status);
        // ログイン状態を確認して処理
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          return sessionData.session.user.id;
        }
        return null;
      }
      
      const data = await response.json();
      return data.user.id;
    } catch (err) {
      console.error('セッション確認エラー:', err);
      return null;
    }
  };

  // 認証情報エラー時の再認証を試みる
  const attemptReauth = async () => {
    try {
      // サインアウトしてセッションをクリア
      await supabase.auth.signOut();
      
      // ここで再ログインの案内など
      return false;
    } catch (err) {
      console.error('再認証エラー:', err);
      return false;
    }
  };

  // 最初の読み込み時に実行
  useEffect(() => {
    const initializeProfile = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 認証方法1: ハードコーディングされたモックユーザーID
        // 注: 開発環境では認証を簡略化するためのものです。本番環境では実際の認証システムを使用してください
        const mockUserId = '12345-mock-user-id';
        console.log('開発用モックユーザーID:', mockUserId);
        setUserId(mockUserId);
        
        // 既存のプロファイルデータを取得
        const { data: profileData, error: profileError } = await supabase
          .from(TABLE_NAME)
          .select('*')
          .eq('user_id', mockUserId)
          .maybeSingle();
        
        if (profileError) {
          console.error('プロファイル検索エラー:', profileError);
        }
        
        if (profileData) {
          console.log('既存のプロファイルデータ:', profileData);
          setProfile(profileData);
          setExistingProfile(profileData);
        } else {
          console.log('既存のプロファイルが見つかりません。新規作成モード');
        }
      } catch (err) {
        console.error('初期化エラー:', err);
        setError('プロファイル情報の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };
    
    initializeProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setError(null);
    setSuccess(false);
    
    if (!userId) {
      setError('ユーザーIDが見つかりません');
      setSaveLoading(false);
      return;
    }
    
    try {
      console.log(`${TABLE_NAME}テーブルにデータを保存しています`);
      
      // プロファイルデータを準備
      let profileData;
      
      if (existingProfile?.id) {
        // 既存プロファイルの更新
        profileData = {
          ...profile,
          id: existingProfile.id,
          user_id: userId,
          updated_at: new Date()
        };
      } else {
        // 新規プロファイルの作成
        profileData = {
          ...profile,
          id: uuidv4(),
          user_id: userId,
          created_at: new Date(),
          updated_at: new Date()
        };
      }
      
      console.log('保存するプロファイルデータ:', profileData);
      
      // データベース操作
      let result;
      
      if (existingProfile?.id) {
        // 更新操作
        result = await supabase
          .from(TABLE_NAME)
          .update({
            name: profileData.name,
            bio: profileData.bio,
            subjects: profileData.subjects,
            updated_at: profileData.updated_at
          })
          .eq('id', existingProfile.id)
          .select();
      } else {
        // 挿入操作
        result = await supabase
          .from(TABLE_NAME)
          .insert([profileData])
          .select();
      }
      
      console.log('Save to tutor_profiles result:', result);
      
      if (result.error) {
        console.error('データ保存エラー:', result.error);
        setError(`データ保存エラー: ${result.error.message}`);
      } else {
        console.log('プロファイル保存成功:', result.data);
        setSuccess(true);
        
        // 新規作成の場合、返されたデータをセット
        if (!existingProfile && result.data?.[0]) {
          setExistingProfile(result.data[0]);
          setProfile(result.data[0]);
        }
      }
    } catch (err) {
      console.error('プロフィール設定エラー:', err);
      setError(`予期せぬエラーが発生しました: ${err.message}`);
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">講師プロフィール設定</h1>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
            <p className="mt-4">プロファイル情報を読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">講師プロフィール設定</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          プロフィールが正常に保存されました。
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">名前</label>
          <input
            type="text"
            name="name"
            value={profile.name || ''}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">自己紹介</label>
          <textarea
            name="bio"
            value={profile.bio || ''}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded"
            rows="4"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">指導可能科目</label>
          <input
            type="text"
            name="subjects"
            value={profile.subjects || ''}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded"
            placeholder="数学、英語、プログラミングなど"
          />
        </div>
        
        {/* 他の必要なフィールド */}
        
        <button
          type="submit"
          disabled={saveLoading}
          className={`px-4 py-2 rounded text-white ${saveLoading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
        >
          {saveLoading ? '保存中...' : 'プロフィールを保存'}
        </button>
      </form>
      
      <div className="mt-8 text-sm text-gray-500">
        <p>※プロフィール情報は公開されます。個人を特定する情報は記載しないでください。</p>
      </div>
    </div>
  );
}
