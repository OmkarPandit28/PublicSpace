import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, UserPlus, Check, X, UserMinus, Users } from "lucide-react";

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  profile: Profile | null;
}

const Friends = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<FriendshipRow[]>([]);
  const [incoming, setIncoming] = useState<FriendshipRow[]>([]);
  const [outgoing, setOutgoing] = useState<FriendshipRow[]>([]);
  const [relMap, setRelMap] = useState<Record<string, "friends" | "pending_out" | "pending_in">>({});

  useEffect(() => { document.title = "Friends · PublicSpace"; }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const rows = (data ?? []) as FriendshipRow[];
    const otherIds = rows.map((r) => r.requester_id === user.id ? r.addressee_id : r.requester_id);
    const profiles = otherIds.length
      ? (await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", otherIds)).data ?? []
      : [];
    const pmap: Record<string, Profile> = {};
    (profiles as Profile[]).forEach((p) => { pmap[p.id] = p; });

    const enriched = rows.map((r) => {
      const otherId = r.requester_id === user.id ? r.addressee_id : r.requester_id;
      return { ...r, profile: pmap[otherId] ?? null };
    });

    const f: FriendshipRow[] = [], inc: FriendshipRow[] = [], out: FriendshipRow[] = [];
    const map: Record<string, "friends" | "pending_out" | "pending_in"> = {};
    enriched.forEach((r) => {
      const otherId = r.requester_id === user.id ? r.addressee_id : r.requester_id;
      if (r.status === "accepted") { f.push(r); map[otherId] = "friends"; }
      else if (r.requester_id === user.id) { out.push(r); map[otherId] = "pending_out"; }
      else { inc.push(r); map[otherId] = "pending_in"; }
    });
    setFriends(f); setIncoming(inc); setOutgoing(out); setRelMap(map);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const doSearch = async () => {
    if (!user || !search.trim()) { setResults([]); return; }
    setSearching(true);
    const q = search.trim();
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq("id", user.id)
      .limit(20);
    setResults((data as Profile[]) ?? []);
    setSearching(false);
  };

  const sendRequest = async (otherId: string) => {
    if (!user) return;
    const { error } = await supabase.from("friendships").insert({
      requester_id: user.id, addressee_id: otherId, status: "pending",
    });
    if (error) toast.error(error.message); else toast.success("Friend request sent");
    await load();
  };

  const accept = async (id: string) => {
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    if (error) toast.error("Failed"); else toast.success("Friend added!");
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("friendships").delete().eq("id", id);
    if (error) toast.error("Failed"); else toast.success("Removed");
    await load();
  };

  const renderProfile = (p: Profile, action: React.ReactNode) => {
    const initials = (p.display_name || p.username).slice(0, 2).toUpperCase();
    return (
      <div key={p.id} className="flex items-center justify-between rounded-lg p-3 hover:bg-secondary/50 transition-smooth">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={p.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-semibold">{p.display_name}</div>
            <div className="text-xs text-muted-foreground">@{p.username}</div>
          </div>
        </div>
        {action}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-2xl px-4 py-6">
        <Card className="mb-5 bg-gradient-primary p-5 text-primary-foreground shadow-glow">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8" />
            <div>
              <div className="text-sm opacity-80">Total friends</div>
              <div className="text-3xl font-bold">{friends.length}</div>
              <div className="text-xs opacity-80 mt-0.5">
                {friends.length === 0 && "Add 1 friend to start posting"}
                {friends.length >= 1 && friends.length <= 10 && `${friends.length} posts/day allowed`}
                {friends.length > 10 && "Unlimited posts!"}
              </div>
            </div>
          </div>
        </Card>

        <Card className="mb-5 p-5 bg-gradient-card shadow-soft">
          <Label className="mb-2 block text-sm font-medium">Find people</Label>
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username or name"
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
            />
            <Button onClick={doSearch} variant="hero" disabled={searching}>
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
          {results.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-border pt-3">
              {results.map((p) => {
                const rel = relMap[p.id];
                let action: React.ReactNode;
                if (rel === "friends") action = <span className="text-xs font-medium text-success">Friends</span>;
                else if (rel === "pending_out") action = <span className="text-xs text-muted-foreground">Pending</span>;
                else if (rel === "pending_in") action = <span className="text-xs text-accent">Request received</span>;
                else action = (
                  <Button size="sm" variant="hero" onClick={() => sendRequest(p.id)}>
                    <UserPlus className="h-4 w-4" /> Add
                  </Button>
                );
                return renderProfile(p, action);
              })}
            </div>
          )}
        </Card>

        <Tabs defaultValue="friends">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends">Friends ({friends.length})</TabsTrigger>
            <TabsTrigger value="incoming">Requests ({incoming.length})</TabsTrigger>
            <TabsTrigger value="outgoing">Sent ({outgoing.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="friends">
            <Card className="p-2 bg-gradient-card">
              {friends.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No friends yet. Search above!</p>
              ) : friends.map((r) => r.profile && renderProfile(r.profile, (
                <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                  <UserMinus className="h-4 w-4" />
                </Button>
              )))}
            </Card>
          </TabsContent>

          <TabsContent value="incoming">
            <Card className="p-2 bg-gradient-card">
              {incoming.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No pending requests.</p>
              ) : incoming.map((r) => r.profile && renderProfile(r.profile, (
                <div className="flex gap-1">
                  <Button size="sm" variant="hero" onClick={() => accept(r.id)}><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><X className="h-4 w-4" /></Button>
                </div>
              )))}
            </Card>
          </TabsContent>

          <TabsContent value="outgoing">
            <Card className="p-2 bg-gradient-card">
              {outgoing.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No sent requests.</p>
              ) : outgoing.map((r) => r.profile && renderProfile(r.profile, (
                <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>Cancel</Button>
              )))}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const Label = ({ children, className, ...rest }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={className} {...rest}>{children}</label>
);

export default Friends;
