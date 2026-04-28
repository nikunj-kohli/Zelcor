import React from 'react';

const BlockchainCertificates = () => {
  const certificates = [
    { id: '#PX-9921', item: 'iPhone 15 Pro', status: 'Refunded', date: 'Oct 24, 2023', hash: '0x71c...3A92' },
    { id: '#PX-9541', item: 'Sony Headphones', status: 'Released', date: 'Sep 12, 2023', hash: '0x32a...9B21' },
    { id: '#PX-9210', item: 'Apartment Deposit', status: 'Refunded', date: 'Aug 05, 2023', hash: '0xf8e...4C12' }
  ];

  return (
    <div className="bg-[#f8f9fc] min-h-screen font-body-lg text-on-surface">
      <header className="bg-white border-b border-slate-100 h-16 flex items-center px-8 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="material-symbols-outlined text-slate-400 hover:text-primary transition-colors">arrow_back</a>
          <h1 className="font-h2 text-lg font-bold">Blockchain Certificates</h1>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto p-8 pt-12 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="w-20 h-20 rounded-[32px] bg-primary/10 flex items-center justify-center text-primary mx-auto">
            <span className="material-symbols-outlined text-4xl">dataset</span>
          </div>
          <h2 className="font-h1 text-4xl tracking-tighter text-primary">Your Immutable Proofs</h2>
          <p className="text-on-surface-variant">Every complaint and transaction on Zelcor is hashed on the Ethereum Sepolia blockchain. These certificates are legally binding proof of your claims.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {certificates.map((cert) => (
            <div key={cert.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group">
              <div className="flex justify-between items-start mb-8">
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${cert.status === 'Refunded' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
                  {cert.status}
                </div>
                <span className="material-symbols-outlined text-slate-200 group-hover:text-primary transition-colors">verified</span>
              </div>
              <div className="space-y-2 mb-8">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{cert.id}</p>
                <h3 className="font-h3 text-xl">{cert.item}</h3>
                <p className="text-sm text-slate-500">{cert.date}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl mb-8 flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="material-symbols-outlined text-sm text-slate-300">link</span>
                  <span className="font-data-mono text-[10px] text-slate-400 truncate">{cert.hash}</span>
                </div>
                <button className="material-symbols-outlined text-sm text-slate-300 hover:text-primary">open_in_new</button>
              </div>
              <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary transition-all">
                <span className="material-symbols-outlined text-sm">download</span>
                Download PDF Proof
              </button>
            </div>
          ))}
        </div>

        {/* Info Card */}
        <div className="bg-primary p-12 rounded-[48px] text-white flex flex-col md:flex-row items-center gap-12 shadow-2xl shadow-primary/30">
          <div className="flex-1 space-y-6">
            <h3 className="font-h2 text-3xl tracking-tighter">How to use these certificates?</h3>
            <p className="text-white/70">These PDFs contain a QR code that links directly to the blockchain hash. You can submit these to consumer courts or insurance ombudsmen as evidence that your complaint was filed and validated at a specific time.</p>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-white/50">check_circle</span>
                <span className="text-sm font-bold">Tamper Proof</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-white/50">check_circle</span>
                <span className="text-sm font-bold">Time Stamped</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-white/50">check_circle</span>
                <span className="text-sm font-bold">Legally Binding</span>
              </div>
            </div>
          </div>
          <div className="w-48 h-48 bg-white p-4 rounded-3xl shadow-inner flex items-center justify-center">
            {/* Fake QR Code */}
            <div className="grid grid-cols-4 gap-2 w-full h-full opacity-20">
              {[...Array(16)].map((_, i) => (
                <div key={i} className={`bg-slate-900 rounded-sm ${i % 3 === 0 ? 'opacity-100' : ''}`}></div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BlockchainCertificates;
