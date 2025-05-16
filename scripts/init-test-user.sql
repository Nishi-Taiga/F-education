-- テストデータをクリア
DELETE FROM bookings;
DELETE FROM tutor_shifts;
DELETE FROM tutors;
DELETE FROM students;
DELETE FROM users WHERE username IN ('testuser', 'testutor');

-- テストユーザー（保護者）を作成
INSERT INTO users (
  username, 
  password,
  display_name, 
  email, 
  phone, 
  postal_code, 
  prefecture, 
  city, 
  address, 
  profile_completed, 
  ticket_count, 
  role
) VALUES (
  'testuser',
  '9f8b535cb4c7f0c009d343c3ea480d747a07583a7e2d300113c451b3671ceae2e495977a7c0b26696951e27b8849edc34cb1f4af1339a7ee957941465fba2f10.b4f6639cd4599ab06b636c5d112748b8',
  'テストユーザー',
  'test@example.com',
  '090-1234-5678',
  '100-0001',
  '東京都',
  '千代田区',
  '千代田1-1-1',
  true,
  10,
  'user'
);

-- テストユーザーのIDを取得
DO $$
DECLARE
  test_user_id INTEGER;
  test_tutor_user_id INTEGER;
  test_tutor_id INTEGER;
BEGIN
  -- テストユーザーのIDを取得
  SELECT id INTO test_user_id FROM users WHERE username = 'testuser';
  
  -- テスト生徒1を作成（高校生）
  INSERT INTO students (
    user_id, 
    last_name, 
    first_name, 
    last_name_furigana, 
    first_name_furigana, 
    gender, 
    school, 
    grade, 
    birth_date
  ) VALUES (
    test_user_id,
    'テスト',
    '太郎',
    'てすと',
    'たろう',
    'male',
    'テスト高等学校',
    '高校2年生',
    '2008-05-15'
  );
  
  -- テスト生徒2を作成（小学生）
  INSERT INTO students (
    user_id, 
    last_name, 
    first_name, 
    last_name_furigana, 
    first_name_furigana, 
    gender, 
    school, 
    grade, 
    birth_date
  ) VALUES (
    test_user_id,
    'テスト',
    '花子',
    'てすと',
    'はなこ',
    'female',
    'テスト小学校',
    '3年生',
    '2015-08-23'
  );
  
  -- テスト講師ユーザーを作成
  INSERT INTO users (
    username, 
    password,
    display_name, 
    email,
    profile_completed,
    tutor_profile_completed,
    role
  ) VALUES (
    'testutor',
    'c1335e1e85b22a4919c839d6d070c2f0fb78b45248f876d9df794080f2c2110920bf0aacd190324a0e1ff29aa6fa67801c5d23aca9641fc729dc9912f060e0db.95bb4a643985dc8eb9dbd0568f2aa70f',
    'テスト講師',
    'tutor@example.com',
    true,
    true,
    'tutor'
  );
  
  -- テスト講師ユーザーのIDを取得
  SELECT id INTO test_tutor_user_id FROM users WHERE username = 'testutor';
  
  -- テスト講師プロフィールを作成
  INSERT INTO tutors (
    user_id,
    last_name,
    first_name,
    last_name_furigana,
    first_name_furigana,
    university,
    birth_date,
    subjects,
    bio
  ) VALUES (
    test_tutor_user_id,
    '講師',
    '太郎',
    'こうし',
    'たろう',
    '東京大学',
    '1995-01-15',
    '小学国語,小学算数,中学数学,高校数学',
    '数学が得意な講師です。分かりやすい授業を心がけています。'
  );
  
  -- テスト講師のIDを取得
  SELECT id INTO test_tutor_id FROM tutors WHERE user_id = test_tutor_user_id;
  
  -- テスト講師のシフトを追加（現在の日付から1週間分）
  FOR i IN 1..7 LOOP
    -- 各日付に3つの時間帯のシフトを作成
    INSERT INTO tutor_shifts (
      tutor_id,
      date,
      time_slot,
      subject,
      is_available
    ) VALUES
    (
      test_tutor_id,
      (CURRENT_DATE + i)::text,
      '16:00-17:30',
      '小学算数',
      true
    ),
    (
      test_tutor_id,
      (CURRENT_DATE + i)::text,
      '18:00-19:30',
      '中学数学',
      true
    ),
    (
      test_tutor_id,
      (CURRENT_DATE + i)::text,
      '20:00-21:30',
      '高校数学',
      true
    );
  END LOOP;
  
END $$;