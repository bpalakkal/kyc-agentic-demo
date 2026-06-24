import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  function validateKpmg(e: string) {
    return e.trim().toLowerCase().endsWith("@kpmg.com");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!validateKpmg(email)) {
      setError("Access is restricted to @kpmg.com email addresses.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) setError("Sign-in failed. Check your credentials and try again.");
    setLoading(false);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!validateKpmg(email)) {
      setError("Access is restricted to @kpmg.com email addresses.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });
    if (err) setError("Account creation failed. Please try again or contact your administrator.");
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — brand panel */}
      <div className="hidden md:flex w-2/5 bg-gradient-to-br from-blue-900 to-indigo-900 flex-col items-center justify-center p-12 gap-6">
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-[28px] rounded-full bg-gradient-to-b from-blue-400 to-indigo-400 shrink-0" />
          <div>
            <div className="text-[22px] font-bold text-white tracking-tight leading-tight">KYC Sentinel</div>
          </div>
        </div>
        <p className="text-blue-200 text-sm text-center max-w-[220px] leading-relaxed">
          Intelligent KYC compliance, powered by AI
        </p>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile-only brand */}
          <div className="flex items-center gap-2.5 mb-8 md:hidden">
            <div className="w-[3px] h-[22px] rounded-full bg-gradient-to-b from-blue-500 to-indigo-500 shrink-0" />
            <div>
              <div className="text-[17px] font-bold text-foreground tracking-tight leading-tight">KYC Sentinel</div>
            </div>
          </div>

          <Tabs defaultValue="signin" onValueChange={() => setError("")}>
            <TabsList className="w-full mb-6">
              <TabsTrigger value="signin" className="flex-1">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">Create Account</TabsTrigger>
            </TabsList>

            {/* Sign In */}
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">KPMG Email</label>
                  <Input
                    type="email"
                    placeholder="you@kpmg.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</label>
                  <Input
                    type="password"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading || !email || !password}>
                  {loading ? <><Loader2 className="size-4 animate-spin mr-2" />Signing in…</> : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            {/* Sign Up */}
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full Name</label>
                  <Input
                    type="text"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">KPMG Email</label>
                  <Input
                    type="email"
                    placeholder="you@kpmg.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</label>
                  <Input
                    type="password"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading || !name || !email || !password}>
                  {loading ? <><Loader2 className="size-4 animate-spin mr-2" />Creating account…</> : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Access is restricted to authorised KPMG team members.
          </p>
        </div>
      </div>
    </div>
  );
}
