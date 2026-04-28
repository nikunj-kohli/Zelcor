import React, { useState } from 'react';

const ComplaintModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-white w-full max-w-[500px] rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="p-10 pb-0 flex justify-between items-center">
          <h2 className="font-h2 text-2xl tracking-tighter">Report Issue</h2>
          <button onClick={onClose} className="material-symbols-outlined text-slate-400 hover:text-primary transition-colors">close</button>
        </div>

        <div className="p-10 space-y-8">
          {/* Progress Mini */}
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? 'bg-primary' : 'bg-slate-100'}`}></div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <h3 className="font-h3 text-xl">What's wrong?</h3>
                <p className="text-sm text-on-surface-variant">Select a category for your complaint.</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {['Wrong product', 'Damaged', 'Never arrived', 'Partial refund'].map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => setStep(2)}
                    className="w-full p-4 rounded-2xl border border-slate-100 hover:border-primary hover:bg-primary/5 text-left font-bold text-sm transition-all flex justify-between items-center group"
                  >
                    {cat}
                    <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-all">arrow_forward</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <h3 className="font-h3 text-xl">Upload Evidence</h3>
                <p className="text-sm text-on-surface-variant">AI needs to see the problem to validate.</p>
              </div>
              <div className="aspect-video border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center gap-3 hover:border-primary/20 cursor-pointer group">
                <span className="material-symbols-outlined text-3xl text-slate-300 group-hover:text-primary transition-colors">add_a_photo</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Take Photo / Upload</span>
              </div>
              <button 
                onClick={() => setStep(3)}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm"
              >Continue</button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl">smart_toy</span>
              </div>
              <div className="space-y-2">
                <h3 className="font-h3 text-xl">Submit to AI Review</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">Our AI will analyze your evidence and notify the company. This creates an immutable blockchain proof.</p>
              </div>
              <button 
                onClick={() => {
                  onClose();
                  window.location.href = '/complaint/PX-9921';
                }}
                className="w-full py-4 bg-secondary text-white rounded-2xl font-bold text-sm shadow-lg shadow-secondary/20"
              >Submit Complaint</button>
              <button onClick={() => setStep(2)} className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-primary transition-all">Go Back</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComplaintModal;
