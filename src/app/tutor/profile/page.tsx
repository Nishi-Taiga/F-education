
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
  const [formData, setFormData] = useState({
    last_name: '',
    first_name: '',
    last_name_furigana: '',
    first_name_furigana: '',
    bio: '',
    subjects: '',
    email: ''
  });
  
  const [profileId, setProfileId] = useState('');
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // 初期化
  useEffect(() => {
    const fetchUserAndProfile = async () => {
      setLoading(true);
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
        setUserId(session.user.id);
        setUserEmail(session.user.email || '');
        setFormData(prev => ({ ...prev, email: session.user.email || '' }));
        
        // 既存のプロファイルを検索
        try {
          const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (error) {
            console.error('プロファイル検索エラー:', error);
          } else if (data) {
            console.log('既存のプロファイルを読み込みました:', data);
            setProfileId(data.id || '');
            setFormData({
              last_name: data.last_name || '',
              first_name: data.first_name || '',
              last_name_furigana: data.last_name_furigana || '',
              first_name_furigana: data.first_name_furigana || '',
              bio: data.bio || '',
              subjects: data.subjects || '',
              email: data.email || session.user.email || ''
            });
          } else {
            console.log('プロファイルが見つかりません。新規作成モードです。');
            // 新しいUUIDを生成
            const newId = uuidv4();
            console.log('生成された新しいプロファイルID:', newId);
            setProfileId(newId);
          }
        } catch (err) {
          console.error('プロファイル検索中のエラー:', err);
        }
      } catch (err) {
        console.error('セッション取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserAndProfile();
  }, []);

  // フォーム入力処理
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // フォーム送信処理
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setError(null);
    setSuccess(false);
    
    if (!userId) {
      setError('ユーザー情報が見つかりません。再度ログインしてください。');
      setSaveLoading(false);
      return;
    }
    
    try {
      // データを保存する前に、IDをまだ持っていない場合は新しく生成
      const currentProfileId = profileId || uuidv4();
      console.log('使用するプロファイルID:', currentProfileId);
      
      // ダイレクトSQL実行による保存（低レベルAPIを使用）
      const { data, error } = await supabase.rpc('save_tutor_profile', {
        p_id: currentProfileId,
        p_user_id: userId,
        p_first_name: formData.first_name,
        p_last_name: formData.last_name,
        p_first_name_furigana: formData.first_name_furigana,
        p_last_name_furigana: formData.last_name_furigana,
        p_bio: formData.bio,
        p_subjects: formData.subjects,
        p_email: formData.email,
        p_profile_completed: true
      });
      
      if (error) {
        console.error('プロシージャ実行エラー:', error);
        
        // 代替方法: 直接RawSQL実行 (RPCが使えない場合のフォールバック)
        const timestamp = new Date().toISOString();
        const { data: rawData, error: rawError } = await supabase.from(TABLE_NAME).insert({
          id: currentProfileId,
          user_id: userId,
          first_name: formData.first_name,
          last_name: formData.last_name,
          first_name_furigana: formData.first_name_furigana,
          last_name_furigana: formData.last_name_furigana,
          bio: formData.bio,
          subjects: formData.subjects,
          email: formData.email,
          profile_completed: true,
          created_at: timestamp,
          updated_at: timestamp
        }).select();
        
        if (rawError) {
          console.error('直接挿入エラー:', rawError);
          
          // 最終手段: 既存のレコードがあれば更新、なければ挿入
          if (profileId) {
            // 既存レコードの更新
            const { error: updateError } = await supabase
              .from(TABLE_NAME)
              .update({
                first_name: formData.first_name,
                last_name: formData.last_name,
                first_name_furigana: formData.first_name_furigana,
                last_name_furigana: formData.last_name_furigana,
                bio: formData.bio,
                subjects: formData.subjects,
                email: formData.email,
                profile_completed: true,
                updated_at: timestamp
              })
              .eq('id', profileId);
            
            if (updateError) {
              console.error('更新エラー:', updateError);
              setError(`データ保存エラー: ${updateError.message}`);
            } else {
              console.log('プロファイルが更新されました');
              setSuccess(true);
            }
          } else {
            setError(`データ保存エラー: ${rawError.message}`);
          }
        } else {
          console.log('プロファイルが保存されました:', rawData);
          setSuccess(true);
          if (!profileId) {
            setProfileId(currentProfileId);
          }
        }
      } else {
        console.log('プロシージャ実行成功:', data);
        setSuccess(true);
        if (!profileId) {
          setProfileId(currentProfileId);
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
  if (!userId) {
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
      
      {/* デバッグ情報 */}
      <div className="mb-4 p-2 bg-gray-100 text-xs text-gray-600 rounded">
        ユーザーID: {userId}<br />
        プロファイルID: {profileId || '新規作成'}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">姓</label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
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
              value={formData.first_name}
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
              value={formData.last_name_furigana}
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
              value={formData.first_name_furigana}
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
            value={formData.email}
            readOnly
            className="w-full p-2 border border-gray-300 rounded bg-gray-100"
          />
          <p className="text-sm text-gray-500 mt-1">※認証情報から自動取得されます</p>
        </div>
        
        <div>
          <label className="block text-gray-700 mb-2">自己紹介</label>
          <textarea
            name="bio"
            value={formData.bio}
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
            value={formData.subjects}
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
