
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアントの設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// テーブル名
const TABLE_NAME = 'tutor_profiles';

export default function TutorProfilePage() {
  const [formData, setFormData] = useState({
    // idはinteger型なので、文字列ではなく数値型にする
    // 空欄のままにして、サーバー側での自動採番に任せる
    last_name: '',
    first_name: '',
    last_name_furigana: '',
    first_name_furigana: '',
    bio: '',
    subjects: '',
    university: '',
    birth_date: '',
    email: '',
    profile_completed: true,
    is_active: true
  });
  
  const [profileId, setProfileId] = useState(null); // integer型のIDを保存
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [userSession, setUserSession] = useState(null);

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
        
        setUserSession(session);
        console.log('Session found, user email:', session.user.email);
        
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
            // IDを別変数で保存
            setProfileId(data.id);
            
            // フォームデータにプロファイル情報をセット
            setFormData({
              last_name: data.last_name || '',
              first_name: data.first_name || '',
              last_name_furigana: data.last_name_furigana || '',
              first_name_furigana: data.first_name_furigana || '',
              bio: data.bio || '',
              subjects: data.subjects || '',
              university: data.university || '',
              birth_date: data.birth_date || '',
              email: data.email || session.user.email || '',
              profile_completed: true,
              is_active: data.is_active !== false
            });
          } else {
            console.log('プロファイルが見つかりません。新規作成モードです。');
            // 新規プロファイル用の初期データを設定
            setFormData(prev => ({
              ...prev,
              email: session.user.email || ''
            }));
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
    
    if (!userSession) {
      setError('ユーザー情報が見つかりません。再度ログインしてください。');
      setSaveLoading(false);
      return;
    }
    
    try {
      // 保存するデータを準備
      const saveData = {
        ...formData,
        user_id: userSession.user.id
      };
      
      console.log('保存するデータ:', saveData);
      
      let result;
      
      if (profileId) {
        // 既存プロファイルの更新
        console.log(`プロファイルID ${profileId} を更新します`);
        result = await supabase
          .from(TABLE_NAME)
          .update(saveData)
          .eq('id', profileId)
          .select();
      } else {
        // 新規プロファイルの作成
        // idフィールドなしで挿入（自動採番させる）
        console.log('新規プロファイルを作成します');
        result = await supabase
          .from(TABLE_NAME)
          .insert(saveData)
          .select();
      }
      
      const { data, error: saveError } = result;
      
      if (saveError) {
        console.error('プロファイル保存エラー:', saveError);
        
        // エラーメッセージの詳細表示
        const errorDetails = saveError.details 
          ? `詳細: ${saveError.details}` 
          : '';
        
        setError(`データ保存エラー: ${saveError.message} ${errorDetails}`);
        
        // テーブル構造のデバッグ情報を表示
        const { data: columns } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable')
          .eq('table_name', TABLE_NAME);
        
        console.log('テーブル構造:', columns);
      } else {
        console.log('プロファイルが保存されました:', data);
        setSuccess(true);
        
        // 新規作成の場合、返されたIDを保存
        if (!profileId && data && data[0]) {
          setProfileId(data[0].id);
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
  if (!userSession) {
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
        <div><strong>ユーザーID:</strong> {userSession?.user?.id || '-'}</div>
        <div><strong>プロファイルID:</strong> {profileId ? profileId : '新規作成'}</div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">姓</label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name || ''}
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
              value={formData.first_name || ''}
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
              value={formData.last_name_furigana || ''}
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
              value={formData.first_name_furigana || ''}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded"
              required
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-2">大学名</label>
            <input
              type="text"
              name="university"
              value={formData.university || ''}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-700 mb-2">生年月日</label>
            <input
              type="date"
              name="birth_date"
              value={formData.birth_date || ''}
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
            value={formData.email || ''}
            readOnly
            className="w-full p-2 border border-gray-300 rounded bg-gray-100"
          />
          <p className="text-sm text-gray-500 mt-1">※認証情報から自動取得されます</p>
        </div>
        
        <div>
          <label className="block text-gray-700 mb-2">自己紹介</label>
          <textarea
            name="bio"
            value={formData.bio || ''}
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
            value={formData.subjects || ''}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded"
            placeholder="数学、英語、プログラミングなど（カンマ区切りで入力）"
            required
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
