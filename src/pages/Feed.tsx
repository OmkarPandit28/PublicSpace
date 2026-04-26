import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { PostComposer } from "@/components/PostComposer";
import { PostCard, FeedPost } from "@/components/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePostingStatus } from "@/hooks/usePostingStatus";
import { Card } from "@/components/ui/card";
import { Users, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const Feed = () => {
  const { user } = useAuth();
  const status = usePostingStatus();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "Feed · PublicSpace"; }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: rawPosts, error } = await supabase
      .from("posts")
      .select(`
        id, user_id, media_url, media_type, caption, created_at,
        profile:profiles!posts_user_id_profiles_fkey(username, display_name, avatar_url)
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) { setLoading(false); return; }

    const ids = (rawPosts ?? []).map((p: any) => p.id);
    if (ids.length === 0) { setPosts([]); setLoading(false); return; }

    const [likesRes, myLikesRes, commentsRes, sharesRes] = await Promise.all([
      supabase.from("likes").select("post_id").in("post_id", ids),
      supabase.from("likes").select("post_id").in("post_id", ids).eq("user_id", user.id),
      supabase.from("comments").select("post_id").in("post_id", ids),
      supabase.from("shares").select("post_id").in("post_id", ids),
    ]);

    const count = (rows: any[] | null, id: string) => rows?.filter((r) => r.post_id === id).length ?? 0;
    const myLiked = new Set((myLikesRes.data ?? []).map((r: any) => r.post_id));

    const enriched: FeedPost[] = (rawPosts as any[]).map((p) => ({
      ...p,
      like_count: count(likesRes.data, p.id),
      comment_count: count(commentsRes.data, p.id),
      share_count: count(sharesRes.data, p.id),
      liked_by_me: myLiked.has(p.id),
    }));
    setPosts(enriched);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-6">
        {/* Stats card */}
        <Card className="mb-5 flex items-center justify-between bg-gradient-primary p-4 text-primary-foreground shadow-glow">
          <div>
            <div className="text-xs opacity-80">Your daily limit</div>
            <div className="text-xl font-bold">
              {status.loading ? "..." : status.dailyLimit === -1 ? "Unlimited" : `${status.postsToday}/${status.dailyLimit}`}
            </div>
          </div>
          <Link to="/friends" className="flex items-center gap-2 rounded-lg bg-primary-foreground/20 px-3 py-2 text-sm font-medium backdrop-blur transition-smooth hover:bg-primary-foreground/30">
            <Users className="h-4 w-4" />
            {status.friendsCount} {status.friendsCount === 1 ? "friend" : "friends"}
          </Link>
        </Card>

        <div className="mb-5">
          <PostComposer onPosted={load} />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-12 text-center bg-gradient-card">
            <Sparkles className="h-10 w-10 text-primary" />
            <div className="text-lg font-semibold">No posts yet</div>
            <p className="text-sm text-muted-foreground">
              Be the first to share something — or add friends to start posting.
            </p>
          </Card>
        ) : (
          <div className="space-y-5">
            {posts.map((p) => <PostCard key={p.id} post={p} onChanged={load} />)}
          </div>
        )}
      </main>
    </div>
  );
};

export default Feed;
