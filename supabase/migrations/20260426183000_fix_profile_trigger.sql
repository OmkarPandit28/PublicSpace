DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();