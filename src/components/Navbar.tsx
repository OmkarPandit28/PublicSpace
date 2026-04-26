import { Link, useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Home, Users, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Navbar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const links = [
    { to: "/feed", label: "Feed", icon: Home },
    { to: "/friends", label: "Friends", icon: Users },
    { to: "/profile", label: "Profile", icon: UserIcon },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to={user ? "/feed" : "/"} className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            <span className="text-gradient">Public</span>Space
          </span>
        </Link>

        {user ? (
          <nav className="flex items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to}>
                <Button
                  variant={pathname === to ? "secondary" : "ghost"}
                  size="sm"
                  className={cn("gap-2", pathname === to && "shadow-sm")}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Button>
              </Link>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { await signOut(); navigate("/"); }}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth?tab=signup"><Button variant="hero" size="sm">Get started</Button></Link>
          </div>
        )}
      </div>
    </header>
  );
};
