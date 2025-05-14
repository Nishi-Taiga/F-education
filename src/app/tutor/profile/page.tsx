
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
    // 現在のセッション情報とユーザーを取得
    const fetchUserSession = async () => {
      try {
        // まずセッションを取得
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('セッション取得エラー:', sessionError);
          return;
        }
        
        if (!sessionData?.session) {
          console.warn('有効なセッションがありません');
          return;
        }
        
        console.log('セッション情報:', sessionData);
        
        // セッションからユーザー情報を取得
        const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('ユーザー情報取得エラー:', userError);
          return;
        }
        
        if (!authUser) {
          console.warn('認証されたユーザーが見つかりません');
          return;
        }
        
        console.log('認証ユーザー:', authUser);
        setUser(authUser);
        
        // 既存のプロファイルデータを取得
        try {
          // user_idフィールドが認証ユーザーのIDと一致するプロファイルを検索
          const { data: profileData, error: profileError } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle(); // single()ではなくmaybeSingle()を使用
            
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
          console.error('プロファイル取得時の例外:', err);
        }
      } catch (err) {
        console.error('認証/セッション処理時の例外:', err);
      }
    };
    
    fetchUserSession();
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
      setError('ユーザー認証情報が見つかりません');
      setLoading(false);
      return;
    }
    
    try {
      // テーブル確認とデバッグログ
      console.log(`${TABLE_NAME}テーブルにデータを保存しています`);
      
      // 既存のプロファイルを使用するか、新しいIDを生成
      let profileData;
      
      if (existingProfile?.id) {
        // 既存のプロファイルを更新する場合は、そのIDを保持
        profileData = {
          ...profile,
          id: existingProfile.id, // 既存IDを保持
          user_id: user.id,
          updated_at: new Date()
        };
        console.log('既存プロファイルの更新:', existingProfile.id);
      } else {
        // 新規作成の場合はIDを生成
        const newId = uuidv4(); // 新しいUUID
        profileData = {
          ...profile,
          id: newId,
          user_id: user.id,
          created_at: new Date(),
          updated_at: new Date()
        };
        console.log('新規プロファイル作成:', newId);
      }
      
      console.log('保存するプロファイルデータ:', profileData);
      
      // 既存プロファイルの場合は更新、新規の場合は挿入
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
      
      console.log('Supabase操作結果:', result);
      
      if (result.error) {
        console.error('データ保存エラー:', result.error);
        setError(`データ保存エラー: ${result.error.message}`);
        
        if (result.error.details) {
          console.error('エラー詳細:', result.error.details);
        }
      } else {
        console.log('プロファイル保存成功:', result.data);
        setSuccess(true);
        
        // 新規作成の場合は、作成されたプロファイルを既存プロファイルとして設定
        if (!existingProfile && result.data?.[0]) {
          setExistingProfile(result.data[0]);
          setProfile(result.data[0]);
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
      
      {!user ? (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          認証情報を読み込み中、または認証されていません。ログインしてください。
        </div>
      ) : (
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
      )}
    </div>
  );
}
