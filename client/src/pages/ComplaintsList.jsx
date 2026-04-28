import React from 'react';

const ComplaintsList = () => {
  const complaints = [
    { id: '#PX-9921', item: 'iPhone 15 Pro', company: 'PremiumGadgets_IN', amount: '₹1,25,000', status: 'AI Review', date: 'Oct 24, 2023' },
    { id: '#PX-9844', item: 'Software License', company: 'DevSolutions', amount: '₹8,500', status: 'Awaiting Co.', date: 'Oct 22, 2023' },
    { id: '#PX-9541', item: 'Sony Headphones', company: 'Sony India', amount: '₹24,900', status: 'Settled', date: 'Sep 12, 2023' },
    { id: '#PX-9210', item: 'Apartment Deposit', company: 'Skyline Rentals', amount: '₹45,000', status: 'Refunded', date: 'Aug 05, 2023' }
  ];

  return (
    <div className="bg-[#f8f9fc] min-h-screen font-body-lg text-on-surface">
      <header className="bg-white border-b border-slate-100 h-16 flex items-center px-8 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="material-symbols-outlined text-slate-400 hover:text-primary transition-colors">arrow_back</a>
          <h1 className="font-h2 text-lg font-bold">All Complaints</h1>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto p-8 pt-12 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="font-h1 text-4xl tracking-tighter">Your Case History</h2>
            <p className="text-on-surface-variant">Track the progress of all your filed disputes and auto-refunds.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-400">search</span>
              <input type="text" placeholder="Search cases..." className="bg-transparent border-none text-sm focus:ring-0 w-48" />
            </div>
            <a href="/file-complaint" className="bg-primary text-on-primary px-8 py-3 rounded-2xl font-bold text-sm hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">add</span>
              New Complaint
            </a>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-4 p-1.5 bg-slate-100 rounded-2xl w-fit">
          <button className="px-6 py-2 bg-white rounded-xl font-bold text-xs text-primary shadow-sm">All Cases</button>
          <button className="px-6 py-2 rounded-xl font-bold text-xs text-slate-400 hover:text-on-surface transition-all">Active</button>
          <button className="px-6 py-2 rounded-xl font-bold text-xs text-slate-400 hover:text-on-surface transition-all">Resolved</button>
        </div>

        {/* Complaints Table */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-10 py-6">Complaint ID</th>
                <th className="px-6 py-6">Item / Service</th>
                <th className="px-6 py-6">Amount</th>
                <th className="px-6 py-6">Status</th>
                <th className="px-6 py-6">Date</th>
                <th className="px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {complaints.map((comp) => (
                <tr key={comp.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => window.location.href = `/complaint/${comp.id.replace('#', '')}`}>
                  <td className="px-10 py-8 font-data-mono text-sm text-slate-400">{comp.id}</td>
                  <td className="px-6 py-8">
                    <div>
                      <p className="font-bold mb-1">{comp.item}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{comp.company}</p>
                    </div>
                  </td>
                  <td className="px-6 py-8 font-bold text-primary">{comp.amount}</td>
                  <td className="px-6 py-8">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      comp.status === 'Settled' || comp.status === 'Refunded' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'
                    }`}>
                      {comp.status}
                    </span>
                  </td>
                  <td className="px-6 py-8 text-sm text-slate-500">{comp.date}</td>
                  <td className="px-10 py-8 text-right">
                    <button className="material-symbols-outlined text-slate-200 group-hover:text-primary transition-all">chevron_right</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default ComplaintsList;
