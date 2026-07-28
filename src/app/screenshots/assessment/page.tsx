'use client';

import { MOCK_CLAIM } from '../_mock-data';

const DEP_RATES: Record<string, number> = { metal: 10, plastic: 50, glass: 0, fiberglass: 30, labour: 0, paint: 0 };

function depRate(partType: string) {
  return DEP_RATES[partType] ?? 0;
}

function assessed(estimated: number, partType: string) {
  return estimated * (1 - depRate(partType) / 100);
}

export default function AssessmentScreenshotPage() {
  const rows = MOCK_CLAIM.assessmentRows;
  const totalEstimated = rows.reduce((s, r) => s + r.estimated, 0);
  const totalAssessed = rows.reduce((s, r) => s + (r.allowed ? assessed(r.estimated, r.partType) : 0), 0);

  return (
    <div className="min-h-screen bg-[#F0F2F5] font-sans text-slate-900 p-6">
      {/* App chrome — tab bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden mb-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-black/5">
          <div className="w-7 h-7 rounded-lg bg-[#0D1B2A] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div className="text-xs font-black text-slate-900">MH-12-AB-4567 · Maruti Suzuki Swift ZXi</div>
            <div className="text-[10px] text-slate-400">Claim: UIIC/PUN/CLM/2026/009876 · Final Survey</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-700 border border-amber-300/30">Draft</div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-black/5 overflow-x-auto">
          {['Overview', 'Documents', 'Assessment', 'Report', 'Fee Bill'].map((tab) => (
            <button
              key={tab}
              className={`px-5 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                tab === 'Assessment'
                  ? 'border-b-2 border-amber-400 text-amber-600 bg-amber-400/5'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Assessment tab content */}
        <div className="p-5">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-lg" style={{ background: '#0D1B2A' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="white" strokeWidth="2"/><line x1="5" y1="12" x2="19" y2="12" stroke="white" strokeWidth="2"/></svg>
                Add Row
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 rounded-lg border border-black/10 bg-white">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2"/></svg>
                AI Extract
              </button>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              {rows.length} items · {rows.filter(r => r.allowed).length} allowed
            </div>
          </div>

          {/* Grid table */}
          <div className="rounded-xl border border-black/5 overflow-hidden text-xs">
            {/* Header */}
            <div className="grid bg-[#0D1B2A] text-white font-bold" style={{ gridTemplateColumns: '32px 40px 1fr 80px 90px 90px 70px 60px 100px' }}>
              <div className="px-2 py-2.5 text-center">#</div>
              <div className="px-2 py-2.5 text-center">Type</div>
              <div className="px-3 py-2.5">Particulars</div>
              <div className="px-2 py-2.5 text-center">GST %</div>
              <div className="px-2 py-2.5 text-right">Estimated</div>
              <div className="px-2 py-2.5 text-right">Assessed</div>
              <div className="px-2 py-2.5 text-center">Dep %</div>
              <div className="px-2 py-2.5 text-center">Allow</div>
              <div className="px-2 py-2.5 text-center">Action</div>
            </div>

            {/* Rows */}
            {rows.map((row, i) => {
              const dep = depRate(row.partType);
              const typeColours: Record<string, string> = {
                metal: 'bg-blue-100 text-blue-700',
                plastic: 'bg-purple-100 text-purple-700',
                glass: 'bg-cyan-100 text-cyan-700',
                labour: 'bg-green-100 text-green-700',
                paint: 'bg-pink-100 text-pink-700',
              };
              const actionColours: Record<string, string> = {
                replace: 'bg-blue-100 text-blue-700',
                repair: 'bg-amber-100 text-amber-700',
                disallow: 'bg-red-100 text-red-700',
              };
              return (
                <div
                  key={row.id}
                  className={`grid border-t border-black/5 ${!row.allowed ? 'opacity-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                  style={{ gridTemplateColumns: '32px 40px 1fr 80px 90px 90px 70px 60px 100px' }}
                >
                  <div className="px-2 py-2 text-center text-slate-400">{row.srNo}</div>
                  <div className="px-2 py-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${typeColours[row.partType] ?? 'bg-gray-100 text-gray-600'}`}>
                      {row.partType.slice(0, 3)}
                    </span>
                  </div>
                  <div className="px-3 py-2 font-medium text-slate-800 leading-tight">{row.particulars}</div>
                  <div className="px-2 py-2 text-center text-slate-500">{row.gst}%</div>
                  <div className="px-2 py-2 text-right text-slate-700">₹{row.estimated.toLocaleString('en-IN')}</div>
                  <div className={`px-2 py-2 text-right font-semibold ${row.allowed ? 'text-slate-900' : 'text-red-400 line-through'}`}>
                    {row.allowed ? `₹${assessed(row.estimated, row.partType).toLocaleString('en-IN')}` : '—'}
                  </div>
                  <div className="px-2 py-2 text-center text-slate-500">{dep > 0 ? `${dep}%` : '—'}</div>
                  <div className="px-2 py-2 flex justify-center items-center">
                    <div className={`w-4 h-4 rounded flex items-center justify-center ${row.allowed ? 'bg-green-500' : 'bg-slate-200'}`}>
                      {row.allowed && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                    </div>
                  </div>
                  <div className="px-2 py-2 flex justify-center">
                    {row.action && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${actionColours[row.action] ?? 'bg-gray-100'}`}>
                        {row.action}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Totals row */}
            <div className="grid bg-slate-900 text-white font-bold border-t-2 border-amber-400/30" style={{ gridTemplateColumns: '32px 40px 1fr 80px 90px 90px 70px 60px 100px' }}>
              <div className="px-2 py-2.5" />
              <div className="px-2 py-2.5" />
              <div className="px-3 py-2.5 text-amber-400">TOTAL</div>
              <div className="px-2 py-2.5" />
              <div className="px-2 py-2.5 text-right text-amber-200">₹{totalEstimated.toLocaleString('en-IN')}</div>
              <div className="px-2 py-2.5 text-right text-amber-400">₹{Math.round(totalAssessed).toLocaleString('en-IN')}</div>
              <div className="px-2 py-2.5" />
              <div className="px-2 py-2.5" />
              <div className="px-2 py-2.5" />
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { label: 'Parts (est.)', val: `₹${totalEstimated.toLocaleString('en-IN')}`, sub: 'before depreciation', color: 'text-slate-700' },
              { label: 'Parts (assessed)', val: `₹${Math.round(totalAssessed).toLocaleString('en-IN')}`, sub: 'after depreciation', color: 'text-slate-900' },
              { label: 'Compulsory Excess', val: '₹1,000', sub: 'deducted', color: 'text-red-600' },
              { label: 'Net Assessed Loss', val: '₹87,382', sub: 'incl. GST', color: 'text-emerald-600 font-black' },
            ].map(({ label, val, sub, color }) => (
              <div key={label} className="rounded-xl bg-white border border-black/5 shadow-sm p-4">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{label}</div>
                <div className={`text-base font-black ${color}`}>{val}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
