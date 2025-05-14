
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
    id: '',  // 明示的にidを含める
    user_id: '',
    last_name: '',
    first_name: '',
    last_name_furigana: '',
    first_name_furigana: '',
    bio: '',
    subjects: '',
    email: '',
    profile_completed: false,
    created_at: null,
    updated_at: null
  });
  
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
            // 既存データをそのまますべて使用
            setFormData(data);
          } else {
            console.log('プロファイルが見つかりません。新規作成モードです。');
            // 新しいUUIDを生成
            const newId = uuidv4();
            console.log('生成された新しいプロファイルID:', newId);
            
            // 現在の日時
            const now = new Date().toISOString();
            
            // 新規プロファイル用の初期データを設定
            setFormData({
              ...formData,
              id: newId,
              user_id: session.user.id,
              email: session.user.email || '',
              created_at: now,
              updated_at: now
            });
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

  // Fetch APIを使用した直接的な保存
  const directSave = async (data) => {
    try {
      // APIエンドポイント
      const endpoint = `${supabaseUrl}/rest/v1/${TABLE_NAME}`;
      
      // セッションからトークンを取得
      const token = supabase.auth.session()?.access_token || userSession?.access_token;
      
      if (!token) {
        console.error('認証トークンが見つかりません');
        return { error: { message: '認証トークンが見つかりません' } };
      }
      
      // 既存のプロファイルかどうかをチェック
      const isUpdate = Boolean(data.id && formData.created_at);
      
      // HTTPメソッドとエンドポイント
      const method = isUpdate ? 'PATCH' : 'POST';
      const url = isUpdate ? `${endpoint}?id=eq.${data.id}` : endpoint;
      
      console.log(`${method} リクエストを実行します:`, url);
      console.log('保存するデータ:', data);
      
      // リクエスト実行
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP エラー ${response.status}:`, errorText);
        return { error: { message: `HTTP エラー ${response.status}: ${errorText}` } };
      }
      
      const result = await response.json();
      console.log('保存成功:', result);
      return { data: result };
    } catch (err) {
      console.error('直接保存エラー:', err);
      return { error: { message: err.message } };
    }
  };

  // フォーム送信処理
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setError(null);
    setSuccess(false);
    
    if (!formData.user_id) {
      setError('ユーザー情報が見つかりません。再度ログインしてください。');
      setSaveLoading(false);
      return;
    }
    
    try {
      // 保存前にIDが確実に含まれていることを確認
      if (!formData.id) {
        const newId = uuidv4();
        console.log('IDが見つからないため、新たに生成します:', newId);
        setFormData(prev => ({ ...prev, id: newId }));
      }
      
      // 更新日時を設定
      const now = new Date().toISOString();
      const updatedData = {
        ...formData,
        updated_at: now,
        profile_completed: true
      };
      
      // 新規作成の場合は作成日時も設定
      if (!formData.created_at) {
        updatedData.created_at = now;
      }
      
      console.log('保存するデータを準備:', updatedData);
      
      // データベースにレコードが存在するか確認し、IDがSupabaseによって自動生成されていないか確認
      const { count, error: countError } = await supabase
        .from(TABLE_NAME)
        .select('id', { count: 'exact', head: true })
        .eq('id', formData.id);
      
      if (countError) {
        console.warn('レコード存在確認エラー:', countError);
      }
      
      const recordExists = count && count > 0;
      console.log(`レコードID ${formData.id} の存在: ${recordExists ? '存在する' : '存在しない'}`);
      
      // 直接的な保存を試みる
      const { data, error } = await directSave(updatedData);
      
      if (error) {
        console.error('直接保存に失敗:', error);
        
        // SQL文を使った挿入を最終手段として試みる
        try {
          console.log('RPC経由で保存を試みます');
          
          // テーブル構造を出力
          const { data: tableInfo } = await supabase
            .rpc('get_table_structure', { table_name: TABLE_NAME });
          
          console.log('テーブル構造:', tableInfo);
          
          // データ配列を準備
          const values = [
            updatedData.id,
            updatedData.user_id,
            updatedData.first_name,
            updatedData.last_name,
            updatedData.first_name_furigana,
            updatedData.last_name_furigana,
            updatedData.bio || '',
            updatedData.subjects || '',
            updatedData.email,
            updatedData.profile_completed,
            updatedData.created_at,
            updatedData.updated_at
          ];
          
          console.log('SQL挿入値:', values);
          
          // SQL実行 - ここでは実際に実行しませんが、最終手段の例として示します
          setError(`データ保存エラー: ${error.message}`);
        } catch (rpcErr) {
          console.error('RPC実行エラー:', rpcErr);
          setError(`データ保存エラー: ${error.message}`);
        }
      } else {
        console.log('プロファイルが保存されました:', data);
        setSuccess(true);
        
        // 返されたデータでフォームを更新
        if (data && (Array.isArray(data) ? data[0] : data)) {
          const savedData = Array.isArray(data) ? data[0] : data;
          setFormData(savedData);
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
        <div><strong>ユーザーID:</strong> {formData.user_id}</div>
        <div><strong>プロファイルID:</strong> {formData.id || '新規作成'}</div>
        <div><strong>作成日時:</strong> {formData.created_at || '-'}</div>
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
