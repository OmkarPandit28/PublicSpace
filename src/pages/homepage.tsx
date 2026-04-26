import { Link, Navigate } from "react-router-dom";
import { Sparkles, Heart, MessageCircle, Share2, Users, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/feed" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-hero opacity-10" aria-hidden />
          <div className="container relative mx-auto px-4 py-20 md:py-32">
            <div className="mx-auto max-w-3xl text-center animate-fade-in">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm backdrop-blur">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">A community that rewards real connections</span>
              </div>
              <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-7xl">
                Share moments with{" "}
                <span className="text-gradient">people you trust</span>
              </h1>
              <p className="mb-10 text-lg text-muted-foreground md:text-xl">
                Post photos and short videos, like, comment, and share. The more friends
                you have, the more you can post — meaningful content, by design.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/auth?tab=signup">
                  <Button variant="hero" size="lg" className="min-w-[180px]">
                    Join the community
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="outline" size="lg" className="min-w-[180px]">
                    I have an account
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: Camera, title: "Photos & short videos", desc: "Up to 50MB, 30s videos. Capture and share life as it happens." },
              { icon: Heart, title: "Like, comment, share", desc: "Real interactions with real people in your circle." },
              { icon: Users, title: "Friends-based limits", desc: "0 friends? 0 posts. 10+ friends? Post anything, anytime." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group rounded-2xl border border-border bg-gradient-card p-6 shadow-soft transition-smooth hover:shadow-elevated hover:-translate-y-1">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Posting limits explained */}
        <section className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-4xl rounded-3xl bg-gradient-primary p-1 shadow-elevated">
            <div className="rounded-[calc(theme(borderRadius.3xl)-4px)] bg-card p-8 md:p-12">
              <h2 className="mb-2 text-3xl font-bold">How posting limits work</h2>
              <p className="mb-8 text-muted-foreground">
                We reward genuine connections. Your daily post count grows with your friends.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { friends: "0", limit: "Cannot post" },
                  { friends: "1", limit: "1 post / day" },
                  { friends: "2", limit: "2 posts / day" },
                  { friends: "10+", limit: "Unlimited" },
                ].map((tier) => (
                  <div key={tier.friends} className="rounded-xl border border-border bg-secondary/40 p-5 text-center">
                    <div className="text-3xl font-bold text-gradient">{tier.friends}</div>
                    <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">friends</div>
                    <div className="mt-3 text-sm font-medium">{tier.limit}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
          <div className="container mx-auto flex items-center justify-center gap-1.5">
            <MessageCircle className="h-4 w-4" />
            <Share2 className="h-4 w-4" />
            <Heart className="h-4 w-4" />
            <span className="ml-2">Built with love on Lovable Cloud</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
