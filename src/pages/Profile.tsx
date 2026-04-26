import { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { usePostingStatus } from "@/hooks/usePostingStatus";

const Profile = () => {
  const { user } = useAuth();
  const status = usePostingStatus();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.title = "Profile · PublicSpace"; }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setUsername(data.username ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      }
    })();
  }, [user?.id]);

  const save = async () => {
    if (!user) return;
    if (displayName.trim().length < 1 || displayName.length > 50) {
      toast.error("Display name must be 1-50 chars"); return;
    }
    if (bio.length > 280) { toast.error("Bio max 280 chars"); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim(),
      bio: bio.trim() || null,
    }).eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Profile saved!");
  };

  const uploadAvatar = async (f: File) => {
    if (!user) return;
    if (!f.type.startsWith("image/")) { toast.error("Image only"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setUploading(true);
    const ext = f.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, f, { upsert: true });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
    setUploading(false);
    if (updErr) { toast.error(updErr.message); return; }
    setAvatarUrl(pub.publicUrl);
    toast.success("Avatar updated");
  };

  const initials = (displayName || username || "?").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-6">
        <Card className="bg-gradient-card p-6 shadow-soft">
          <div className="mb-6 flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20 ring-4 ring-primary/20">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xl">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary shadow-glow transition-smooth hover:scale-110"
                aria-label="Change avatar"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" /> : <Camera className="h-4 w-4 text-primary-foreground" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
              />
            </div>
            <div className="flex-1">
              <div className="text-xl font-bold">{displayName || "Your name"}</div>
              <div className="text-sm text-muted-foreground">@{username}</div>
              <div className="mt-2 flex gap-3 text-xs">
                <span className="rounded-full bg-secondary px-3 py-1 font-medium">
                  {status.friendsCount} friends
                </span>
                <span className="rounded-full bg-secondary px-3 py-1 font-medium">
                  {status.dailyLimit === -1 ? "Unlimited" : `${status.postsToday}/${status.dailyLimit}`} today
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={username} disabled />
              <p className="text-xs text-muted-foreground">Username can't be changed.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dn">Display name</Label>
              <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={3} placeholder="Tell people about yourself..." />
              <p className="text-right text-xs text-muted-foreground">{bio.length}/280</p>
            </div>
            <Button onClick={save} variant="hero" disabled={busy} className="w-full">
              {busy ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
