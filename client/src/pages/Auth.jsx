import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const Auth = () => {
  const [loading, setLoading] = useState(false);

  // Real Google Login
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard',
        },
      });
      if (error) throw error;
    } catch (error) {
      alert('Google Login Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Demo Login
  const handleDemoLogin = () => {
    localStorage.setItem('zelcor_demo_id', '11111111-1111-1111-1111-111111111111');
    window.location.href = '/dashboard';
  };

  return (
    <div className="bg-[#f8f9fc] min-h-screen flex items-center justify-center p-4 sm:p-6 mesh-gradient relative overflow-hidden font-body-lg">
      {/* Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px]"></div>

      <div className="bg-white w-full max-w-[440px] p-6 sm:p-10 lg:p-12 rounded-[28px] sm:rounded-[48px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] relative z-10 border border-slate-100">
        <div className="text-center space-y-3 mb-8 sm:mb-12">
          <div className="text-4xl sm:text-5xl font-black tracking-tighter text-primary">zelcor</div>
          <h2 className="font-h2 text-2xl tracking-tighter text-slate-900">Secure the Trust</h2>
          <p className="text-sm text-slate-400 font-medium sm:px-8">The decentralized escrow protocol for the next billion users.</p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 bg-white border-2 border-slate-100 rounded-[20px] flex items-center justify-center gap-4 font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-200 hover:shadow-lg hover:shadow-slate-100 transition-all active:scale-[0.98]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-200 border-t-primary rounded-full animate-spin"></div>
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                Continue with Google
              </>
            )}
          </button>

          <button 
            onClick={handleDemoLogin}
            className="w-full py-4 bg-slate-50 border-2 border-slate-100 rounded-[20px] flex items-center justify-center gap-4 font-bold text-slate-500 hover:bg-slate-100 hover:border-slate-200 transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-sm">rocket_launch</span>
            Explore as Demo User
          </button>
        </div>

        <div className="mt-12 text-center">
          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest leading-relaxed">
            By continuing, you agree to secure your transactions <br /> via Zelcor Smart Contracts.
          </p>
        </div>
      </div>
      
      {/* Footer Branding */}
      <div className="absolute bottom-4 sm:bottom-8 px-4 text-center text-slate-300 text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em]">
        Encrypted • Decentralized • Immutable
      </div>
    </div>
  );
};

export default Auth;
