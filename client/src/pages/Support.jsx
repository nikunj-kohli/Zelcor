import React from 'react';

const Support = () => {
  const faqs = [
    { q: "How long does a refund take?", a: "For Tier 1 claims, if the company doesn't respond within 7 days, you can claim an auto-refund instantly. It typically reflects in your bank account in 2-3 business days." },
    { q: "Is Zelcor really free for customers?", a: "Yes. Customers pay absolutely zero upfront fees. Zelcor takes a small success fee only from the money recovered from the company." },
    { q: "What if the company disputes my claim?", a: "If a company disputes, the case is escalated to Tier 2 where a human case manager reviews both sides and negotiates a resolution." },
    { q: "Can I use Zelcor for UPI payments?", a: "Absolutely. Zelcor is specifically designed to add protection to UPI and bank transfers which normally have no chargeback protection." }
  ];

  return (
    <div className="bg-[#f8f9fc] min-h-screen font-body-lg text-on-surface">
      <header className="bg-white border-b border-slate-100 h-16 flex items-center px-8 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <a href="/" className="material-symbols-outlined text-slate-400 hover:text-primary transition-colors">arrow_back</a>
          <h1 className="font-h2 text-lg font-bold">Help & Support</h1>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto p-8 pt-12">
        <div className="grid lg:grid-cols-12 gap-12">
          {/* Left Column: FAQ */}
          <div className="lg:col-span-7 space-y-12">
            <div className="space-y-4">
              <h2 className="font-h2 text-4xl tracking-tighter">Frequently Asked Questions</h2>
              <p className="text-on-surface-variant text-lg">Everything you need to know about Zelcor's escrow protection and dispute resolution.</p>
            </div>
            <div className="space-y-6">
              {faqs.map((faq, i) => (
                <div key={i} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4 hover:shadow-md transition-all">
                  <h4 className="font-h3 text-xl text-primary">{faq.q}</h4>
                  <p className="text-on-surface-variant leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Contact & Live Chat */}
          <div className="lg:col-span-5 space-y-8">
            {/* Live Chat Card */}
            <div className="bg-primary p-10 rounded-[48px] text-white space-y-8 shadow-xl shadow-primary/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="space-y-2 relative z-10">
                <h3 className="font-h2 text-3xl tracking-tighter">Talk to us live</h3>
                <p className="text-white/70">Our support engineers are available 24/7 to help with your claims.</p>
              </div>
              <button className="w-full py-4 bg-white text-primary rounded-2xl font-h3 text-lg flex items-center justify-center gap-2 hover:shadow-2xl transition-all active:scale-95">
                <span className="material-symbols-outlined">chat</span>
                Start Live Chat
              </button>
            </div>

            {/* Contact Form */}
            <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm space-y-8">
              <div className="space-y-2 text-center">
                <h3 className="font-h3 text-2xl">Send us a message</h3>
                <p className="text-sm text-slate-400">We'll get back to you within 2 hours</p>
              </div>
              <form className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Your Email</label>
                  <input type="email" className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary" placeholder="name@example.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subject</label>
                  <input type="text" className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary" placeholder="What can we help with?" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Message</label>
                  <textarea className="w-full p-6 bg-slate-50 border-none rounded-[32px] focus:ring-2 focus:ring-primary min-h-[120px]" placeholder="Explain your issue in detail..."></textarea>
                </div>
                <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-primary transition-all shadow-lg shadow-slate-900/10">Send Message</button>
              </form>
            </div>

            {/* Direct Contact */}
            <div className="px-8 flex justify-between items-center text-slate-400 text-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">mail</span>
                <span>support@zelcor.io</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">phone</span>
                <span>1800-ZELCOR-HELP</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Support;
