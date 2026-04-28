import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const Settings = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    notifications: true,
    transparency: true,
    twoFactor: false,
    settlementAsset: 'INR',
    resolutionLayer: 'AI',
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('zelcor_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const saveSettings = (next) => {
    setSettings(next);
    localStorage.setItem('zelcor_settings', JSON.stringify(next));
    setMessage('Settings saved.');
    setTimeout(() => setMessage(''), 1500);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('zelcor_demo_id');
    navigate('/auth');
  };

  return (
    <div className="bg-[#f8f9fc] min-h-screen p-10 font-body-lg">
      <div className="max-w-[800px] mx-auto space-y-12">
        <header className="flex justify-between items-center">
          <div>
          <h1 className="font-h1 text-4xl tracking-tight mb-2">Settings</h1>
          <p className="text-slate-400 font-medium">Control your privacy, notifications, and decentralized protocol preferences.</p>
          </div>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 rounded-xl bg-primary/10 text-primary font-bold text-xs">Back to Home</button>
        </header>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}

        <section className="space-y-6">
          <h3 className="font-h2 text-xl text-slate-800">Account & Privacy</h3>
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm divide-y divide-slate-50">
            <SettingsToggle
              label="Real-time Notifications"
              desc="Get alerted when a refund is approved or a dispute is filed."
              active={settings.notifications}
              onToggle={() => saveSettings({ ...settings, notifications: !settings.notifications })}
            />
            <SettingsToggle
              label="Transparency Mode"
              desc="Show successful claims on your trust profile."
              active={settings.transparency}
              onToggle={() => saveSettings({ ...settings, transparency: !settings.transparency })}
            />
            <SettingsToggle
              label="Two-Factor Authentication"
              desc="Require stronger verification before sensitive actions."
              active={settings.twoFactor}
              onToggle={() => saveSettings({ ...settings, twoFactor: !settings.twoFactor })}
            />
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="font-h2 text-xl text-slate-800">Protocol Preferences</h3>
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm divide-y divide-slate-50">
            <div className="p-8 flex justify-between items-center">
              <div>
                <p className="font-bold text-slate-800 mb-1">Preferred Settlement Asset</p>
                <p className="text-xs text-slate-400">Choose which currency you want your refunds in.</p>
              </div>
              <select
                value={settings.settlementAsset}
                onChange={(e) => saveSettings({ ...settings, settlementAsset: e.target.value })}
                className="bg-slate-50 border-none rounded-xl px-4 py-2 font-bold text-xs outline-none"
              >
                <option value="INR">INR (Zelcor Wallet)</option>
                <option value="USDC">USDC (Prototype)</option>
                <option value="ETH">ETH (Prototype)</option>
              </select>
            </div>
            <div className="p-8 flex justify-between items-center">
              <div>
                <p className="font-bold text-slate-800 mb-1">Dispute Resolution Layer</p>
                <p className="text-xs text-slate-400">Select how you want your disputes to be judged.</p>
              </div>
              <div className="flex gap-2">
                 <button
                   onClick={() => saveSettings({ ...settings, resolutionLayer: 'AI' })}
                   className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${settings.resolutionLayer === 'AI' ? 'bg-primary/10 text-primary' : 'bg-slate-50 text-slate-400'}`}
                 >
                   AI Agent
                 </button>
                 <button
                   onClick={() => saveSettings({ ...settings, resolutionLayer: 'DAO' })}
                   className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${settings.resolutionLayer === 'DAO' ? 'bg-primary/10 text-primary' : 'bg-slate-50 text-slate-400'}`}
                 >
                   Community DAO
                 </button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="font-h2 text-xl text-error/80">Danger Zone</h3>
          <div className="bg-error/5 rounded-[40px] border border-error/10 p-8 flex justify-between items-center gap-4">
            <div>
              <p className="font-bold text-error mb-1">Reset Local Preferences</p>
              <p className="text-xs text-error/60">This clears saved device settings and restores defaults.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  localStorage.removeItem('zelcor_settings');
                  const defaults = {
                    notifications: true,
                    transparency: true,
                    twoFactor: false,
                    settlementAsset: 'INR',
                    resolutionLayer: 'AI',
                  };
                  setSettings(defaults);
                  setMessage('Local preferences reset.');
                }}
                className="px-6 py-3 bg-white text-error border border-error/20 rounded-2xl font-black text-[10px] uppercase tracking-widest"
              >
                Reset
              </button>
              <button onClick={handleLogout} className="px-6 py-3 bg-error text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-error/20 hover:opacity-90 transition-all">Logout</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const SettingsToggle = ({ label, desc, active = false, onToggle }) => (
  <div onClick={onToggle} className="p-8 flex justify-between items-center group cursor-pointer hover:bg-slate-50 transition-all first:rounded-t-[40px] last:rounded-b-[40px]">
    <div>
      <p className="font-bold text-slate-800 mb-1">{label}</p>
      <p className="text-xs text-slate-400">{desc}</p>
    </div>
    <div className={`w-12 h-6 rounded-full relative transition-all ${active ? 'bg-primary' : 'bg-slate-200'}`}>
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${active ? 'left-7' : 'left-1'}`}></div>
    </div>
  </div>
);

export default Settings;
