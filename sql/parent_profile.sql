-- Parent profile table
CREATE TABLE IF NOT EXISTS parent_profile (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  postal_code TEXT,
  prefecture TEXT,
  city TEXT,
  address TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for parent_profile
CREATE INDEX IF NOT EXISTS idx_parent_profile_user_id ON parent_profile(user_id);

-- Enable row level security
ALTER TABLE parent_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents can view their own data" ON parent_profile FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Parents can update their own data" ON parent_profile FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Parents can insert their own data" ON parent_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);
