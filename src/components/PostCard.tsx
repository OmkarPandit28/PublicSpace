import { useEffect, useState } from "react";
import { Heart, MessageCircle, Share2, Trash2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { commentSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export interface FeedPost {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "photo" | "video";
  caption: string | null;
  created_at: string;
  profile: { username: string; display_name: string; avatar_url: string | null } | null;
  like_count: number;
  comment_count: number;
  share_count: number;
  liked_by_me: boolean;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile: { username: string; display_name: string; avatar_url: string | null } | null;
}

interface Props {
  post: FeedPost;
  onChanged: () => void;
}

export const PostCard = ({ post, onChanged }: Props) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [shareCount, setShareCount] = useState(post.share_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [popLike, setPopLike] = useState(false);

  useEffect(() => {
    setLiked(post.liked_by_me);
    setLikeCount(post.like_count);
    setShareCount(post.share_count);
  }, [post.id, post.liked_by_me, post.like_count, post.share_count]);

  const loadComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, content, created_at, user_id, profile:profiles!comments_user_id_profiles_fkey(username, display_name, avatar_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setComments((data as Comment[]) ?? []);
  };

  const toggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next) await loadComments();
  };

  const toggleLike = async () => {
    if (!user) return;
    setPopLike(true);
    setTimeout(() => setPopLike(false), 300);
    if (liked) {
      setLiked(false); setLikeCount((c) => c - 1);
      const { error } = await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      if (error) { setLiked(true); setLikeCount((c) => c + 1); toast.error("Failed"); }
    } else {
      setLiked(true); setLikeCount((c) => c + 1);
      const { error } = await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      if (error) { setLiked(false); setLikeCount((c) => c - 1); toast.error("Failed"); }
    }
  };

  const share = async () => {
    if (!user) return;
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: "PublicSpace post", url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied!"); }
    } catch { /* user cancelled */ return; }
    setShareCount((c) => c + 1);
    await supabase.from("shares").insert({ post_id: post.id, user_id: user.id });
  };

  const submitComment = async () => {
    if (!user) return;
    const parsed = commentSchema.safeParse(commentText);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setCommentBusy(true);
    const { error } = await supabase.from("comments").insert({
      post_id: post.id, user_id: user.id, content: parsed.data,
    });
    setCommentBusy(false);
    if (error) { toast.error("Failed to comment"); return; }
    setCommentText("");
    await loadComments();
    onChanged();
  };

  const deletePost = async () => {
    if (!user || user.id !== post.user_id) return;
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) { toast.error("Failed"); return; }
    toast.success("Post deleted");
    onChanged();
  };

  const profile = post.profile;
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();

  return (
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
        {user?.id === post.user_id && (
          <Button variant="ghost" size="icon" onClick={deletePost} aria-label="Delete">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      <div className="bg-muted">
        {post.media_type === "photo" ? (
          <img src={post.media_url} alt={post.caption ?? "Post"} className="w-full max-h-[600px] object-contain" loading="lazy" />
        ) : (
          <video src={post.media_url} controls className="w-full max-h-[600px]" preload="metadata" />
        )}
      </div>

      {post.caption && <p className="px-4 pt-3 text-sm">{post.caption}</p>}

      <div className="flex items-center gap-1 p-2">
        <Button variant="like" size="sm" onClick={toggleLike} className={cn(liked && "text-like")}>
          <Heart className={cn("h-4 w-4 transition-smooth", liked && "fill-like", popLike && "animate-pop")} />
          <span className="tabular-nums">{likeCount}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleComments}>
          <MessageCircle className="h-4 w-4" />
          <span className="tabular-nums">{post.comment_count}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={share}>
          <Share2 className="h-4 w-4" />
          <span className="tabular-nums">{shareCount}</span>
        </Button>
      </div>

      {showComments && (
        <div className="border-t border-border bg-background/50 p-4">
          <div className="mb-3 space-y-3 max-h-64 overflow-y-auto">
            {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet — be the first!</p>}
            {comments.map((c) => {
              const cInit = (c.profile?.display_name || "?").slice(0, 2).toUpperCase();
              return (
                <div key={c.id} className="flex gap-2">
                  <Avatar className="h-7 w-7 mt-0.5">
                    <AvatarImage src={c.profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs bg-secondary">{cInit}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 rounded-lg bg-secondary px-3 py-2">
                    <div className="text-xs font-semibold">{c.profile?.display_name ?? "User"}</div>
                    <div className="text-sm">{c.content}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submitComment())}
              maxLength={1000}
            />
            <Button size="icon" variant="hero" onClick={submitComment} disabled={commentBusy || !commentText.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
