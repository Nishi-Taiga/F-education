
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Supabaseクライアントの設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// テーブル名は指定通り tutor_profiles のままとする
const TABLE_NAME = 'tutor_profiles';

export default function TutorProfilePage() {
  const [profile, setProfile] = useState({
    name: '',
    bio: '',
    subjects: '',
    // 他の必要なフィールド
  });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [existingProfile, setExistingProfile] = useState(null);

  useEffect(() => {
    // 現在のユーザーを取得
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        
        // 既存のプロファイルデータを取得
        try {
          console.log(`Checking for profile in ${TABLE_NAME} table for user: ${user.id}`);
          const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('user_id', user.id)
            .single();
            
          if (error) {
            // エラーはここでは無視（新規ユーザーの場合はデータがない）
            console.log(`No profile found or error: ${error.message}`);
          }
          
          if (data) {
            console.log('Found existing profile data:', data);
            setProfile(data);
            setExistingProfile(data);
          }
        } catch (err) {
          console.error('Error fetching profile:', err);
        }
      }
    };
    
    fetchUser();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    if (!user) {
      setError('認証されていません。再度ログインしてください。');
      setLoading(false);
      return;
    }
    
    try {
      // テーブル確認とデバッグログ
      console.log(`Attempting to save to ${TABLE_NAME} table`);
      
      // テーブル構造を確認
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', TABLE_NAME);
        
      if (!columnsError && columns) {
        console.log('Table columns:', columns);
      }
      
      // 既存のプロファイルを使用するか、新しいIDを生成
      let profileData;
      
      if (existingProfile) {
        // 既存のプロファイルを更新する場合は、そのIDを保持
        profileData = {
          ...profile,
          id: existingProfile.id,
          user_id: user.id,
          updated_at: new Date()
        };
        console.log('Updating existing profile with ID:', existingProfile.id);
      } else {
        // 新規作成の場合はIDを生成
        profileData = {
          ...profile,
          id: uuidv4(), // UUIDを生成
          user_id: user.id,
          created_at: new Date(),
          updated_at: new Date()
        };
        console.log('Creating new profile with generated ID:', profileData.id);
      }
      
      console.log('Saving profile data:', profileData);
      
      // 既存プロファイルの場合は更新、新規の場合は挿入
      let result;
      
      if (existingProfile) {
        // 更新
        result = await supabase
          .from(TABLE_NAME)
          .update(profileData)
          .eq('id', existingProfile.id);
      } else {
        // 挿入
        result = await supabase
          .from(TABLE_NAME)
          .insert(profileData);
      }
      
      if (result.error) {
        console.error('Save error:', result.error);
        setError(`データ保存エラー: ${result.error.message}`);
        
        // エラー詳細
        if (result.error.details) {
          console.error('Error details:', result.error.details);
        }
      } else {
        console.log('Save to tutor_profiles result:', result);
        setSuccess(true);
        
        // 新規作成の場合は、作成されたプロファイルを既存プロファイルとして設定
        if (!existingProfile) {
          setExistingProfile(profileData);
        }
      }
    } catch (err) {
      console.error('プロフィール設定エラー:', err);
      setError(`予期せぬエラーが発生しました: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

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
          disabled={loading}
          className={`px-4 py-2 rounded text-white ${loading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
        >
          {loading ? '保存中...' : 'プロフィールを保存'}
        </button>
      </form>
    </div>
  );
}
