import React, { useState } from 'react';
import { WorkspaceCard } from '../components/workspace/WorkspaceCard';

const SampleButton: React.FC<{label:string, primary?:boolean}> = ({label, primary}) => (
  <button style={{
    background: primary ? 'var(--smriti-button-primary-bg)' : 'transparent',
    color: primary ? 'var(--smriti-button-primary-fg)' : 'var(--smriti-button-secondary-fg)',
    padding: '10px 14px',
    borderRadius: 10,
    border: primary ? 'none' : `1px solid var(--smriti-button-secondary-border)`,
    boxShadow: primary ? '0 6px 18px rgba(45,85,255,0.25)' : 'none'
  }}>{label}</button>
);

const SampleInput: React.FC<{placeholder?:string}> = ({placeholder}) => (
  <input placeholder={placeholder} style={{
    width: '100%',
    height: 'var(--smriti-input-height,48px)',
    background: 'var(--smriti-input-bg)',
    border: `1px solid var(--smriti-input-border)`,
    color: 'var(--smriti-input-fg)',
    padding: '0 12px',
    borderRadius: 10
  }} />
);

const SampleTable: React.FC = () => (
  <table style={{width:'100%', borderCollapse:'collapse'}}>
    <thead style={{background:'var(--smriti-table-header-bg)'}}>
      <tr>
        <th style={{textAlign:'left', padding:12, color:'var(--smriti-table-header-fg)'}}>#</th>
        <th style={{textAlign:'left', padding:12, color:'var(--smriti-table-header-fg)'}}>Item</th>
        <th style={{textAlign:'left', padding:12, color:'var(--smriti-table-header-fg)'}}>Qty</th>
        <th style={{textAlign:'right', padding:12, color:'var(--smriti-table-header-fg)'}}>Amount</th>
      </tr>
    </thead>
    <tbody>
      {[{id:1,item:'Nike Air Max',qty:2,amt:'4,998.00'},{id:2,item:'Puma Runner',qty:1,amt:'1,999.00'}].map(r=> (
        <tr key={r.id} style={{borderBottom:`1px solid var(--smriti-table-separator)`, background:'transparent'}}>
          <td style={{padding:12}}>{r.id}</td>
          <td style={{padding:12}}>{r.item}</td>
          <td style={{padding:12}}>{r.qty}</td>
          <td style={{padding:12, textAlign:'right'}}>{r.amt}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const BottomNav: React.FC<{active?:string}> = ({active='save'}) => (
  <div style={{
    position:'fixed',
    left:16,
    right:16,
    bottom:16 + (typeof window !== 'undefined' ? (window['__env_safe_area_bottom'] || 0) : 0),
    background: 'var(--smriti-bottom-nav-bg)',
    borderRadius: 'var(--smriti-bottom-nav-radius,20px)',
    boxShadow: 'var(--smriti-bottom-nav-shadow)',
    display:'flex',
    alignItems:'center',
    justifyContent:'space-between',
    padding:'12px 18px',
    zIndex:2000
  }}>
    <div style={{display:'flex', gap:18, alignItems:'center'}}>
      <div style={{textAlign:'center', color: active==='menu' ? 'var(--smriti-button-primary-bg)' : 'var(--smriti-text-secondary)'}}>Menu</div>
      <div style={{textAlign:'center', color: active==='hold' ? 'var(--smriti-button-primary-bg)' : 'var(--smriti-text-secondary)'}}>Hold</div>
    </div>
    <div style={{display:'flex', gap:12, alignItems:'center', justifyContent:'center'}}>
      <div style={{width:64,height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', background: 'var(--smriti-button-primary-bg)'}}>Save</div>
    </div>
    <div style={{display:'flex', gap:18, alignItems:'center'}}>
      <div style={{textAlign:'center', color: active==='pay' ? 'var(--c-seef-success)' : 'var(--smriti-text-secondary)'}}>Pay</div>
    </div>
  </div>
)

export default function ThemeQA(){
  const [theme, setTheme] = useState<'light'|'dark'|'high-contrast'>('dark');
  React.useEffect(()=>{
    document.documentElement.setAttribute('data-theme', theme);
  },[theme]);

  return (
    <div style={{padding:24, background:'var(--smriti-workspace-bg)', minHeight:'100vh'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <h2 style={{color:'var(--smriti-text-primary)'}}>SMRITI Theme QA</h2>
        <div style={{display:'flex', gap:8}}>
          <button onClick={()=>setTheme('light')}>Light</button>
          <button onClick={()=>setTheme('dark')}>Dark</button>
          <button onClick={()=>setTheme('high-contrast')}>High Contrast</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
        <WorkspaceCard id="qa-1" title="Card Sample" subtitle="Card subtitle">
          <div style={{display:'flex', flexDirection:'column', gap:12}}>
            <div style={{display:'flex', gap:12}}>
              <SampleButton label="Primary" primary />
              <SampleButton label="Secondary" />
            </div>
            <SampleInput placeholder="Search items (F2)" />
            <SampleTable />
          </div>
        </WorkspaceCard>

        <WorkspaceCard id="qa-2" title="Inputs & Toolbar">
          <div style={{display:'flex', flexDirection:'column', gap:12}}>
            <div style={{display:'flex', gap:12}}>
              <SampleInput placeholder="Customer name" />
              <SampleInput placeholder="Mobile number" />
            </div>
            <div style={{display:'flex', gap:12}}>
              <SampleButton label="Add Line Item (F7)" primary />
              <SampleButton label="Scan Barcode" />
            </div>
          </div>
        </WorkspaceCard>

        <WorkspaceCard id="qa-3" title="Table Sample">
          <SampleTable />
        </WorkspaceCard>

        <WorkspaceCard id="qa-4" title="Bottom Sheet Preview">
          <div style={{height:120}}>Open bottom sheet visually here (static preview)</div>
        </WorkspaceCard>
      </div>

      <BottomNav active="save" />
    </div>
  )
}
