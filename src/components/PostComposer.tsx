import { useRef, useState } from "react";
import { Camera, Loader2, X, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { captionSchema } from "@/lib/validation";
import { usePostingStatus } from "@/hooks/usePostingStatus";

const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_VIDEO_SECONDS = 30;

interface Props {
  onPosted: () => void;
}

export const PostComposer = ({ onPosted }: Props) => {
  const { user } = useAuth();
  const status = usePostingStatus();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"photo" | "video" | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setMediaType(null);
    setCaption("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (f: File) => {
    if (f.size > MAX_BYTES) {
      toast.error("File must be 50MB or less");
      return;
    }
    const isPhoto = f.type.startsWith("image/");
    const isVideo = f.type.startsWith("video/");
    if (!isPhoto && !isVideo) {
      toast.error("Photos and videos only");
      return;
    }
    if (isVideo) {
      // probe duration
      const url = URL.createObjectURL(f);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.src = url;
      await new Promise<void>((resolve) => {
        v.onloadedmetadata = () => resolve();
        v.onerror = () => resolve();
      });
      if (v.duration && v.duration > MAX_VIDEO_SECONDS) {
        URL.revokeObjectURL(url);
        toast.error(`Videos must be ${MAX_VIDEO_SECONDS}s or shorter`);
        return;
      }
      setPreview(url);
    } else {
      setPreview(URL.createObjectURL(f));
    }
    setFile(f);
    setMediaType(isPhoto ? "photo" : "video");
  };

  const submit = async () => {
    if (!user || !file || !mediaType) return;
    const cap = captionSchema.safeParse(caption);
    if (!cap.success) { toast.error("Caption too long"); return; }

    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || (mediaType === "photo" ? "jpg" : "mp4");
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("post-media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("post-media").getPublicUrl(path);

      const { error: insErr } = await supabase.from("posts").insert({
        user_id: user.id,
        media_url: pub.publicUrl,
        media_type: mediaType,
        caption: caption.trim() || null,
      });
      if (insErr) {
        if (insErr.message.toLowerCase().includes("row-level security")) {
          throw new Error("You've reached today's posting limit. Add more friends to unlock more posts.");
        }
        throw insErr;
      }

      toast.success("Posted!");
      reset();
      await status.refresh();
      onPosted();
    } catch (e: any) {
      toast.error(e.message || "Failed to post");
    } finally {
      setBusy(false);
    }
  };

  const limitLabel =
    status.dailyLimit === -1
      ? "Unlimited posts today"
      : `${status.postsToday}/${status.dailyLimit} posts used today`;

  return (
    <Card className="bg-gradient-card p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium">Share something</span>
        <span className={status.canPost ? "text-muted-foreground" : "text-destructive"}>
          {status.loading ? "..." : limitLabel}
        </span>
      </div>

      {!status.canPost && (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {status.friendsCount === 0
            ? "Add at least 1 friend to start posting."
            : "You've reached today's posting limit. Add more friends to unlock more posts."}
        </div>
      )}

      {preview && mediaType === "photo" && (
        <div className="relative mb-3 overflow-hidden rounded-xl">
          <img src={preview} alt="Selected" className="max-h-96 w-full object-cover" />
          <button onClick={reset} className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 backdrop-blur transition-smooth hover:bg-background">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {preview && mediaType === "video" && (
        <div className="relative mb-3 overflow-hidden rounded-xl">
          <video src={preview} controls className="max-h-96 w-full" />
          <button onClick={reset} className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 backdrop-blur">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="What's on your mind? (optional)"
        maxLength={500}
        className="mb-3 resize-none"
        rows={2}
        disabled={!status.canPost}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={!status.canPost || busy}
        >
          {mediaType === "video" ? <Video className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          {file ? "Change media" : "Photo / Video"}
        </Button>
        <Button onClick={submit} disabled={!file || busy || !status.canPost} variant="hero" size="sm">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Posting..." : "Post"}
        </Button>
      </div>
    </Card>
  );
};
