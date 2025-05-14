
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
    id: '',
    first_name: '',
    last_name: '',
    first_name_furigana: '',
    last_name_furigana: '',
    bio: '',
    subjects: '',
    email: '',
    profile_completed: false
  });
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // 初期化
  useEffect(() => {
    const fetchUserAndProfile = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // セッション情報を取得
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('認証セッションが見つかりません');
          setLoading(false);
          return;
        }
        
        console.log('Session found, user email:', session.user.email);
        
        // ユーザー情報を設定
        setUser(session.user);
        
        // tutor_profilesテーブルをチェック
        const { data: profileData, error: profileError } = await supabase
          .from(TABLE_NAME)
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (profileError) {
          console.error('プロファイル検索エラー:', profileError);
        }
        
        if (profileData) {
          console.log('既存のプロファイルデータを読み込みました:', profileData);
          setProfile(profileData);
        } else {
          console.log('既存のプロファイルが見つからないため、新しいIDを生成します');
          // 新しいプロファイル用にUUIDを生成し、ユーザーIDを設定
          setProfile(prev => ({
            ...prev,
            id: uuidv4(),
            user_id: session.user.id,
            email: session.user.email || ''
          }));
        }
      } catch (err) {
        console.error('初期化エラー:', err);
        setError('プロファイル情報の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserAndProfile();
  }, []);

  // フォーム入力処理
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  // フォーム送信処理
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setError(null);
    setSuccess(false);
    
    if (!user) {
      setError('ユーザー情報が見つかりません。再度ログインしてください。');
      setSaveLoading(false);
      return;
    }
    
    try {
      // tutorsテーブルが存在するか確認 (テスト用)
      const { data: tutorsCheck, error: tutorsError } = await supabase
        .from('tutors')
        .select('*')
        .limit(1);
      
      console.log('Tutors table check result:', { data: tutorsCheck, error: tutorsError });
      
      console.log('Trying to save to tutor_profiles table');
      
      // 保存するプロファイルデータを準備
      const updatedProfile = {
        ...profile,
        user_id: user.id,
        updated_at: new Date(),
        profile_completed: true
      };
      
      // IDがない場合は生成する (念のため再確認)
      if (!updatedProfile.id) {
        updatedProfile.id = uuidv4();
        updatedProfile.created_at = new Date();
      }
      
      console.log('Profile data to save:', updatedProfile);
      
      // データ保存実行
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .upsert(updatedProfile, {
          onConflict: 'id',
          returning: '*'
        });
      
      console.log('Save to tutor_profiles result:', { data, error });
      
      if (error) {
        console.error('データ保存エラー:', error);
        
        // idカラムのnot-null制約違反の場合、insertを試す
        if (error.message.includes('violates not-null constraint')) {
          console.log('Trying insert instead of upsert...');
          
          // profileにidが含まれていることを確認
          const insertProfile = { 
            ...updatedProfile,
            id: updatedProfile.id || uuidv4()  // idがなければ生成
          };
          
          const { data: insertData, error: insertError } = await supabase
            .from(TABLE_NAME)
            .insert(insertProfile)
            .select();
          
          if (insertError) {
            console.error('Insert failed:', insertError);
            setError(`データ保存エラー: ${insertError.message}`);
          } else {
            console.log('Insert successful:', insertData);
            setSuccess(true);
            setProfile(insertData[0] || insertProfile);
          }
        } else {
          setError(`データ保存エラー: ${error.message}`);
        }
      } else {
        console.log('保存成功:', data);
        setSuccess(true);
        if (data && data[0]) {
          setProfile(data[0]);
        }
      }
    } catch (err) {
      console.error('プロフィール設定エラー:', err);
      setError(`予期せぬエラーが発生しました: ${err.message}`);
    } finally {
      setSaveLoading(false);
    }
  };

  // ローディング中の表示
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

  // ログインしていない場合の表示
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">講師プロフィール設定</h1>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          ログインしていません。ログインページに移動してください。
        </div>
      </div>
    );
  }

  // メインのフォーム表示
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
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">姓</label>
            <input
              type="text"
              name="last_name"
              value={profile.last_name || ''}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-700 mb-2">名</label>
            <input
              type="text"
              name="first_name"
              value={profile.first_name || ''}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-700 mb-2">姓（フリガナ）</label>
            <input
              type="text"
              name="last_name_furigana"
              value={profile.last_name_furigana || ''}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-700 mb-2">名（フリガナ）</label>
            <input
              type="text"
              name="first_name_furigana"
              value={profile.first_name_furigana || ''}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded"
              required
            />
          </div>
        </div>
        
        <div>
          <label className="block text-gray-700 mb-2">メールアドレス</label>
          <input
            type="email"
            name="email"
            value={profile.email || user.email || ''}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded bg-gray-100"
            readOnly
          />
          <p className="text-sm text-gray-500 mt-1">※認証情報から自動取得されます</p>
        </div>
        
        <div>
          <label className="block text-gray-700 mb-2">自己紹介</label>
          <textarea
            name="bio"
            value={profile.bio || ''}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded"
            rows="4"
          />
        </div>
        
        <div>
          <label className="block text-gray-700 mb-2">指導可能科目</label>
          <input
            type="text"
            name="subjects"
            value={profile.subjects || ''}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded"
            placeholder="数学、英語、プログラミングなど（カンマ区切りで入力）"
          />
        </div>
        
        <div className="pt-4">
          <button
            type="submit"
            disabled={saveLoading}
            className={`px-6 py-3 rounded text-white font-medium ${saveLoading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
          >
            {saveLoading ? '保存中...' : 'プロフィールを保存'}
          </button>
        </div>
      </form>
      
      <div className="mt-8 text-sm text-gray-500">
        <p>※プロフィール情報は公開されます。個人を特定する情報は記載しないでください。</p>
      </div>
    </div>
  );
}
