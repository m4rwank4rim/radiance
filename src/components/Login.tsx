import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { Bot, ArrowRight, AlertCircle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for auth state changes (e.g., when popup completes)
    let subscription: any;
    if (isSupabaseConfigured && supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          navigate('/servers');
        }
      });
      subscription = data.subscription;
    }

    // Also listen for postMessage from the popup
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { hash, session } = event.data;
        console.log("Received success message from popup:", !!session);
        
        if (isSupabaseConfigured && supabase) {
          if (session) {
            // PKCE or session already established in popup
            await supabase.auth.setSession(session);
            console.log("Parent session set successfully");
          } else if (hash) {
            // Implicit flow (older/fallback)
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const providerToken = params.get('provider_token');
            
            if (providerToken) {
              localStorage.setItem('discord_provider_token', providerToken);
            }
            
            if (accessToken && refreshToken) {
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              console.log("Parent implicit session set");
            }
          }
        }
        
        // Final verification check
        const { data: { session: finalSession } } = await supabase!.auth.getSession();
        console.log("Final session verify:", !!finalSession);
        
        navigate('/servers');
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setError(event.data.error?.message || "Failed to authenticate with Discord.");
        setLoading(false);
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      if (subscription) subscription.unsubscribe();
      window.removeEventListener('message', handleMessage);
    };
  }, [navigate]);

  const handleLogin = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Use skipBrowserRedirect to get the URL, then open in a popup
      // This prevents "refused to connect" errors in iframes
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
          scopes: 'identify email guilds'
        }
      });

      if (error) throw error;
      
      if (data?.url) {
        const width = 600;
        const height = 800;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        console.log("Opening Discord OAuth popup:", data.url);
        const popup = window.open(
          data.url,
          'discord_oauth',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );

        if (!popup) {
          console.log("Popup blocked, falling back to redirect flow");
          // Fallback to direct redirect if popup is blocked
          window.location.href = data.url;
        } else {
          // Fallback: check if popup is closed manually
          const checkPopup = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkPopup);
              setLoading(false);
              // If it's closed but we haven't navigated, maybe it failed
              setTimeout(async () => {
                const { data: { session } } = await supabase!.auth.getSession();
                if (session) navigate('/servers');
              }, 1000);
            }
          }, 1000);
        }
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "An unexpected error occurred during login.");
      setLoading(false);
    }
  };

  const handleLoginRedirect = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'identify email guilds'
      }
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="glass-panel w-full max-w-md p-8 rounded-3xl relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-[0_0_30px_rgba(138,43,226,0.5)] mb-6">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold mb-2">Welcome Back</h1>
          <p className="text-text-muted">Sign in with Discord to manage your servers</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <button 
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 disabled:cursor-not-allowed text-white p-4 rounded-xl font-medium flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(88,101,242,0.3)] hover:shadow-[0_0_30px_rgba(88,101,242,0.5)] group"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-6 h-6" viewBox="0 0 127.14 96.36" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.1,46,96,53,91,65.69,84.69,65.69Z"/>
              </svg>
              Login with Discord
              <ArrowRight className="w-5 h-5 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all" />
            </>
          )}
        </button>

        <button
          onClick={handleLoginRedirect}
          className="w-full mt-4 bg-surface-container-high/40 hover:bg-surface-container-highest text-on-surface-variant hover:text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 border border-outline-variant/10 text-[10px] uppercase tracking-widest"
        >
          Problems with popup? Click here
        </button>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-text-muted hover:text-white transition-colors">
            Return to home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
