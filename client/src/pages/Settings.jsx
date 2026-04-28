import React from 'react';

const Settings = () => {
  return (
    <div className="bg-[#f8f9fc] min-h-screen p-10 font-body-lg">
      <div className="max-w-[800px] mx-auto space-y-12">
        <header>
          <h1 className="font-h1 text-4xl tracking-tight mb-2">Settings</h1>
          <p className="text-slate-400 font-medium">Control your privacy, notifications, and decentralized protocol preferences.</p>
        </header>

        <section className="space-y-6">
          <h3 className="font-h2 text-xl text-slate-800">Account & Privacy</h3>
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm divide-y divide-slate-50">
            <SettingsToggle label="Real-time Notifications" desc="Get alerted when a refund is approved or a dispute is filed." active />
            <SettingsToggle label="Blockchain Transparency" desc="Show my successful claims on my public trust profile." active />
            <SettingsToggle label="Two-Factor Authentication" desc="Require Google Auth for every transaction over ₹10,000." />
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
              <select className="bg-slate-50 border-none rounded-xl px-4 py-2 font-bold text-xs outline-none">
                <option>INR (Razorpay)</option>
                <option>USDC (Polygon)</option>
                <option>ETH (Sepolia)</option>
              </select>
            </div>
            <div className="p-8 flex justify-between items-center">
              <div>
                <p className="font-bold text-slate-800 mb-1">Dispute Resolution Layer</p>
                <p className="text-xs text-slate-400">Select how you want your disputes to be judged.</p>
              </div>
              <div className="flex gap-2">
                 <span className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest">AI Agent</span>
                 <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest">Community DAO</span>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="font-h2 text-xl text-error/80">Danger Zone</h3>
          <div className="bg-error/5 rounded-[40px] border border-error/10 p-8 flex justify-between items-center">
            <div>
              <p className="font-bold text-error mb-1">Wipe All Protocol Data</p>
              <p className="text-xs text-error/60">This will permanently delete your trust score and identity history.</p>
            </div>
            <button className="px-6 py-3 bg-error text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-error/20 hover:opacity-90 transition-all">Delete Account</button>
          </div>
        </section>
      </div>
    </div>
  );
};

const SettingsToggle = ({ label, desc, active = false }) => (
  <div className="p-8 flex justify-between items-center group cursor-pointer hover:bg-slate-50 transition-all first:rounded-t-[40px] last:rounded-b-[40px]">
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
