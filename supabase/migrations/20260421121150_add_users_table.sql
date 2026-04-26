
-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  i INT := 0;
BEGIN
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );

  base_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '', 'g');

  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user';
  END IF;

  final_username := base_username;

  WHILE EXISTS (
    SELECT 1 FROM public.profiles WHERE username = final_username
  ) LOOP
    i := i + 1;
    final_username := base_username || i::text;
  END LOOP;

  INSERT INTO public.profiles (
    id,
    username,
    display_name,
    avatar_url,
    bio,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), final_username),
    NEW.raw_user_meta_data->>'avatar_url',
    '',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = now();

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- FRIENDSHIPS
-- =========================================
CREATE TYPE public.friendship_status AS ENUM ('pending', 'accepted');

CREATE TABLE public.friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_friend CHECK (requester_id <> addressee_id),
  CONSTRAINT unique_pair UNIQUE (requester_id, addressee_id)
);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Friendships viewable by participants or anyone (read-only counts)"
  ON public.friendships FOR SELECT USING (true);
CREATE POLICY "Users can send requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Participants can update friendship"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Participants can delete friendship"
  ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE TRIGGER trg_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);

-- Friend count helper
CREATE OR REPLACE FUNCTION public.get_friends_count(_user_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.friendships
  WHERE status = 'accepted'
    AND (requester_id = _user_id OR addressee_id = _user_id);
$$;

-- Daily post limit logic
CREATE OR REPLACE FUNCTION public.get_daily_post_limit(_user_id UUID)
RETURNS INT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c INT;
BEGIN
  c := public.get_friends_count(_user_id);
  IF c = 0 THEN RETURN 0;
  ELSIF c > 10 THEN RETURN 2147483647;
  ELSE RETURN c;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.can_user_post_today(_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lim INT;
  used INT;
BEGIN
  lim := public.get_daily_post_limit(_user_id);
  IF lim = 0 THEN RETURN false; END IF;
  IF lim >= 2147483647 THEN RETURN true; END IF;
  SELECT COUNT(*) INTO used FROM public.posts
    WHERE user_id = _user_id
      AND created_at >= (now() AT TIME ZONE 'UTC')::date;
  RETURN used < lim;
END; $$;

-- =========================================
-- POSTS
-- =========================================
CREATE TYPE public.media_type AS ENUM ('photo', 'video');

CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type public.media_type NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts viewable by everyone"
  ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts within daily limit"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.can_user_post_today(auth.uid()));
CREATE POLICY "Users can update own posts"
  ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts"
  ON public.posts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_posts_user ON public.posts(user_id);
CREATE INDEX idx_posts_created ON public.posts(created_at DESC);

-- =========================================
-- COMMENTS
-- =========================================
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments viewable by everyone"
  ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments"
  ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments"
  ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments"
  ON public.comments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_comments_post ON public.comments(post_id);

-- =========================================
-- LIKES
-- =========================================
CREATE TABLE public.likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes viewable by everyone"
  ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users can like"
  ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike"
  ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- =========================================
-- SHARES
-- =========================================
CREATE TABLE public.shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shares viewable by everyone"
  ON public.shares FOR SELECT USING (true);
CREATE POLICY "Users can share"
  ON public.shares FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========================================
-- STORAGE
-- =========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('post-media', 'post-media', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read post-media"
  ON storage.objects FOR SELECT USING (bucket_id = 'post-media');
CREATE POLICY "Users upload to own folder (post-media)"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own (post-media)"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own (post-media)"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
