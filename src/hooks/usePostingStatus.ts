import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PostingStatus {
  friendsCount: number;
  dailyLimit: number; // -1 = unlimited
  postsToday: number;
  canPost: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const usePostingStatus = (): PostingStatus => {
  const { user } = useAuth();
  const [friendsCount, setFriendsCount] = useState(0);
  const [postsToday, setPostsToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const { count: friends } = await supabase
      .from("friendships")
      .select("*", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count: today } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfDay.toISOString());

    setFriendsCount(friends ?? 0);
    setPostsToday(today ?? 0);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [user?.id]);

  const fc = friendsCount;
  let dailyLimit: number;
  if (fc === 0) dailyLimit = 0;
  else if (fc > 10) dailyLimit = -1;
  else dailyLimit = fc;

  const canPost = dailyLimit === -1 || postsToday < dailyLimit;

  return { friendsCount, dailyLimit, postsToday, canPost, loading, refresh };
};
