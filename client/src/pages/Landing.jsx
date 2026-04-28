import React from 'react';

const Landing = () => {
  return (
    <div className="bg-surface font-body-lg text-on-surface selection:bg-secondary-container min-h-screen">
      {/* 1. TopNavBar */}
      <header className="sticky top-0 w-full z-50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex justify-between items-center">
          <div className="text-2xl font-black tracking-tighter text-primary">zelcor</div>
          <nav className="hidden md:flex items-center gap-8">
            <a className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors" href="#how-it-works">How it Works</a>
            <a className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors" href="#industries">Industries</a>
            <a className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors" href="/dashboard">Dashboard</a>
          </nav>
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="bg-primary text-on-primary px-6 py-2 rounded-full font-bold text-sm hover:opacity-90 transition-all">Get Started</a>
          </div>
        </div>
      </header>

      <main>
        {/* 2. Hero Section */}
        <section className="relative pt-24 pb-32 overflow-hidden mesh-gradient">
          <div className="absolute inset-0 node-pattern opacity-30 pointer-events-none"></div>
          <div className="max-w-[1200px] mx-auto px-6 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-8">
              <span className="material-symbols-outlined text-primary text-sm">verified</span>
              <span className="text-xs font-bold text-primary uppercase tracking-widest">HackIndia Edition</span>
            </div>
            <h1 className="font-h1 text-[64px] leading-[1.1] text-primary mb-8 tracking-tighter max-w-4xl mx-auto">
              Your money doesn't move <br /> until you say so.
            </h1>
            <p className="text-xl text-on-surface-variant max-w-2xl mx-auto mb-12">
              The blockchain escrow platform that flips the power dynamic. Hold payments in smart contracts until you receive what you paid for. Auto-refunds if they cheat.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="w-full sm:w-auto bg-primary text-on-primary px-10 py-4 rounded-xl font-h3 text-lg hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95">Download App</button>
              <button className="w-full sm:w-auto bg-white border border-outline-variant text-on-surface px-10 py-4 rounded-xl font-h3 text-lg hover:bg-slate-50 transition-all active:scale-95">For Business</button>
            </div>
          </div>
        </section>

        {/* 3. Trust Bar */}
        <section className="py-12 border-y border-slate-100 bg-white">
          <div className="max-w-[1200px] mx-auto px-6">
            <p className="text-center text-label font-label text-slate-400 uppercase tracking-widest mb-8">Trusted by 500+ forward-thinking companies</p>
            <div className="flex flex-wrap justify-center items-center gap-12 opacity-50 grayscale">
              <div className="font-black text-2xl text-slate-400">FLIPKART</div>
              <div className="font-black text-2xl text-slate-400">AMAZON</div>
              <div className="font-black text-2xl text-slate-400">POLICYBAZAAR</div>
              <div className="font-black text-2xl text-slate-400">NOBROKER</div>
              <div className="font-black text-2xl text-slate-400">BYJU'S</div>
            </div>
          </div>
        </section>

        {/* 4. How It Works Section */}
        <section id="how-it-works" className="py-24 bg-surface-container-low">
          <div className="max-w-[1200px] mx-auto px-6">
            <h2 className="font-h2 text-h2 text-center mb-16">The Core Mechanism</h2>
            <div className="grid md:grid-cols-3 gap-12">
              <div className="flex flex-col items-center text-center p-8 bg-white rounded-[32px] shadow-sm border border-slate-100">
                <div className="w-16 h-16 rounded-2xl bg-primary-container/10 flex items-center justify-center text-primary mb-6">
                  <span className="material-symbols-outlined text-4xl">payments</span>
                </div>
                <h3 className="font-h3 text-xl mb-4">1. Pay through Zelcor</h3>
                <p className="text-on-surface-variant">Money leaves your account and enters a blockchain smart contract. The company doesn't get it yet.</p>
              </div>
              <div className="flex flex-col items-center text-center p-8 bg-white rounded-[32px] shadow-sm border border-slate-100">
                <div className="w-16 h-16 rounded-2xl bg-secondary-container/10 flex items-center justify-center text-secondary mb-6">
                  <span className="material-symbols-outlined text-4xl">inventory_2</span>
                </div>
                <h3 className="font-h3 text-xl mb-4">2. Receive Product</h3>
                <p className="text-on-surface-variant">You receive your product or service as usual. You have the inspection period to verify everything.</p>
              </div>
              <div className="flex flex-col items-center text-center p-8 bg-white rounded-[32px] shadow-sm border border-slate-100">
                <div className="w-16 h-16 rounded-2xl bg-tertiary-container/10 flex items-center justify-center text-tertiary mb-6">
                  <span className="material-symbols-outlined text-4xl">done_all</span>
                </div>
                <h3 className="font-h3 text-xl mb-4">3. Confirm or Complain</h3>
                <p className="text-on-surface-variant">Everything okay? Click Confirm to release funds. Issue? File a complaint and get an auto-refund.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Three Industries Section */}
        <section id="industries" className="py-24">
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="font-h2 text-h2 mb-6">Protecting your biggest expenses</h2>
              <p className="text-on-surface-variant">Zelcor is the first to connect traditional payments to blockchain escrow for everyday purchases across these core industries.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { name: 'Insurance', icon: 'shield', hold: '2-5% Security Bond' },
                { name: 'Ecommerce', icon: 'shopping_cart', hold: '100% Escrow' },
                { name: 'Rentals', icon: 'apartment', hold: '50% Security Deposit' }
              ].map((ind) => (
                <div key={ind.name} className="p-8 rounded-[32px] bg-white border border-slate-100 hover:border-primary hover:shadow-xl transition-all cursor-pointer group text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-400 group-hover:text-primary mb-4 transition-colors">{ind.icon}</span>
                  <h4 className="font-h3 text-lg mb-2">{ind.name}</h4>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{ind.hold}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Why Zelcor Section */}
        <section className="py-24 bg-primary text-on-primary rounded-[64px] mx-6 mb-24">
          <div className="max-w-[1200px] mx-auto px-6">
            <h2 className="font-h2 text-h2 text-white text-center mb-16">The Blockchain Advantage</h2>
            <div className="grid md:grid-cols-3 gap-12">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white">no_accounts</span>
                </div>
                <h3 className="text-xl font-bold">No upfront cost</h3>
                <p className="text-white/70">You pay nothing. Never. Zelcor takes a small fee only when we recover your money from the company.</p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white">flash_on</span>
                </div>
                <h3 className="text-xl font-bold">Auto refund in one click</h3>
                <p className="text-white/70">If a company ignores your complaint, the smart contract returns your money automatically after 7 days.</p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white">dataset</span>
                </div>
                <h3 className="text-xl font-bold">Blockchain proof forever</h3>
                <p className="text-white/70">Every complaint has an immutable hash on Ethereum. No one can delete or deny your evidence.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Testimonials Section */}
        <section className="py-24">
          <div className="max-w-[1200px] mx-auto px-6">
            <h2 className="font-h2 text-h2 text-center mb-16">Real stories from the frontlines</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { quote: "Got my 15,000 rupee refund in 3 days after the insurance company ignored my claim. The auto-refund is a lifesaver.", author: "Rajesh K., Mumbai" },
                { quote: "Landlord tried to keep my full security deposit for 'paint chips'. I showed the Zelcor blockchain proof from move-in and got it back instantly.", author: "Priya S., Bangalore" },
                { quote: "Ordered a phone that arrived cracked. Filed a complaint, AI validated it, and money was back in my UPI wallet in a week.", author: "Arjun M., Delhi" }
              ].map((t, i) => (
                <div key={i} className="p-8 bg-surface-container-lowest rounded-[32px] border border-slate-100 shadow-sm italic">
                  <p className="text-lg mb-6">"{t.quote}"</p>
                  <p className="font-bold text-sm not-italic">— {t.author}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-24">
        <div className="max-w-[1200px] mx-auto px-6 grid md:grid-cols-4 gap-12">
          <div>
            <div className="text-2xl font-black tracking-tighter text-white mb-6">zelcor</div>
            <p className="text-slate-400 text-sm leading-relaxed">Empowering consumers with decentralized assurance and institutional-grade escrow. Trust, Encoded.</p>
          </div>
          <div>
            <h5 className="font-bold mb-6 uppercase tracking-widest text-[10px] text-slate-500">Product</h5>
            <ul className="space-y-4 text-slate-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">How it works</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-white transition-colors">For Business</a></li>
              <li><a href="#" className="hover:text-white transition-colors">App Store</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold mb-6 uppercase tracking-widest text-[10px] text-slate-500">Resources</h5>
            <ul className="space-y-4 text-slate-400 text-sm">
              <li><a href="/support" className="hover:text-white transition-colors">Help Center</a></li>
              <li><a href="/certificates" className="hover:text-white transition-colors">Blockchain Proof</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Legal Docs</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
          <div className="flex flex-col items-start gap-6">
            <h5 className="font-bold uppercase tracking-widest text-[10px] text-slate-500">Download App</h5>
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/20 transition-all">
                <span className="material-symbols-outlined">apple</span>
              </div>
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/20 transition-all">
                <span className="material-symbols-outlined">android</span>
              </div>
            </div>
            <p className="text-slate-500 text-[10px] mt-auto">© 2024 ZELCOR CORP. HACKINDIA 2024 EDITION.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
