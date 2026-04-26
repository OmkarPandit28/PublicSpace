import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Share2, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface PostView {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "photo" | "video";
  caption: string | null;
  created_at: string;
  profile: { username: string; display_name: string; avatar_url: string | null } | null;
}

const PostPage = () => {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<PostView | null>(null);
  const [counts, setCounts] = useState({ likes: 0, comments: 0, shares: 0 });
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(`
          id, user_id, media_url, media_type, caption, created_at,
          profile:profiles!posts_user_id_profiles_fkey(username, display_name, avatar_url)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error || !data) { setNotFound(true); setLoading(false); return; }
      setPost(data as any);
      document.title = `${(data as any).profile?.display_name ?? "Post"} · PublicSpace`;

      const [l, c, s, cmts] = await Promise.all([
        supabase.from("likes").select("id", { count: "exact", head: true }).eq("post_id", id),
        supabase.from("comments").select("id", { count: "exact", head: true }).eq("post_id", id),
        supabase.from("shares").select("id", { count: "exact", head: true }).eq("post_id", id),
        supabase
          .from("comments")
          .select("id, content, created_at, profile:profiles!comments_user_id_profiles_fkey(username, display_name, avatar_url)")
          .eq("post_id", id)
          .order("created_at", { ascending: true })
          .limit(50),
      ]);
      setCounts({ likes: l.count ?? 0, comments: c.count ?? 0, shares: s.count ?? 0 });
      setComments((cmts.data as any) ?? []);
      setLoading(false);
    })();
  }, [id]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "PublicSpace post", url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied!"); }
    } catch { /* cancelled */ }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto max-w-xl px-4 py-16 text-center">
          <Sparkles className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Post not found</h1>
          <p className="mt-2 text-muted-foreground">It may have been deleted.</p>
          <Link to="/"><Button variant="hero" className="mt-6">Go home</Button></Link>
        </div>
      </div>
    );
  }

  const profile = post.profile;
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-6">
        <Card className="overflow-hidden bg-gradient-card shadow-soft animate-fade-in">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm font-semibold">{profile?.display_name ?? "Unknown"}</div>
                <div className="text-xs text-muted-foreground">
                  @{profile?.username ?? "user"} · {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-muted">
            {post.media_type === "photo" ? (
              <img src={post.media_url} alt={post.caption ?? "Post"} className="w-full max-h-[600px] object-contain" />
            ) : (
              <video src={post.media_url} controls className="w-full max-h-[600px]" />
            )}
          </div>

          {post.caption && <p className="px-4 pt-3 text-sm">{post.caption}</p>}

          <div className="flex items-center gap-4 p-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Heart className="h-4 w-4" />{counts.likes}</span>
            <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" />{counts.comments}</span>
            <span className="flex items-center gap-1.5"><Share2 className="h-4 w-4" />{counts.shares}</span>
            <Button onClick={share} variant="hero" size="sm" className="ml-auto">
              <Share2 className="h-4 w-4" /> Share
            </Button>
          </div>

          {comments.length > 0 && (
            <div className="space-y-3 border-t border-border bg-background/50 p-4">
              {comments.map((c) => {
                const ci = (c.profile?.display_name || "?").slice(0, 2).toUpperCase();
                return (
                  <div key={c.id} className="flex gap-2">
                    <Avatar className="h-7 w-7 mt-0.5">
                      <AvatarImage src={c.profile?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs bg-secondary">{ci}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 rounded-lg bg-secondary px-3 py-2">
                      <div className="text-xs font-semibold">{c.profile?.display_name ?? "User"}</div>
                      <div className="text-sm">{c.content}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="mt-5 rounded-2xl bg-gradient-primary p-6 text-center text-primary-foreground shadow-glow">
          <h2 className="text-lg font-bold">Want to like, comment, or post your own?</h2>
          <p className="mt-1 text-sm opacity-90">Join PublicSpace — it's free.</p>
          <Link to="/auth?tab=signup">
            <Button variant="secondary" className="mt-4">Join the community</Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default PostPage;
