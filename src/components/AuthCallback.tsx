import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const processAuth = async () => {
      if (!supabase) {
        navigate('/login');
        return;
      }

      try {
        console.log("Auth callback starting...");
        
        // Supabase v2 handles the code/hash exchange automatically in the constructor
        // or when any auth method is called. Let's wait a bit for it to process.
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Supabase getSession error:", error);
          throw error;
        }

        console.log("Session established:", !!session);

        // Save provider token for Discord API calls
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);
        const pToken = session?.provider_token || hashParams.get('provider_token') || searchParams.get('provider_token');
        
        if (pToken) {
          localStorage.setItem('discord_provider_token', pToken);
        }

        // If we have a session, we're good. If not, maybe it needs a moment or 
        // it failed. If we're in a popup, tell the parent.
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'OAUTH_AUTH_SUCCESS',
            session: session,
            hash: window.location.hash
          }, '*');
          
          // Small delay before closing to ensure message is sent
          setTimeout(() => window.close(), 800);
        } else {
          // If not a popup, just go to servers
          navigate('/servers');
        }
      } catch (err) {
        console.error('Error during auth callback:', err);
        if (window.opener) {
          window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: err }, '*');
          setTimeout(() => window.close(), 1000);
        } else {
          navigate('/login');
        }
      }
    };

    processAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-text-muted">Completing authentication...</p>
      </div>
    </div>
  );
}
