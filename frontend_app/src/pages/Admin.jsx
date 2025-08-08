import React, { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config.js'

export default function Admin(){
  const [date, setDate] = useState(()=> new Date().toISOString().slice(0,10))
  const [status, setStatus] = useState('')
  const [gmailStatus, setGmailStatus] = useState(null)
  const [auditRows, setAuditRows] = useState([])
  const ADMIN_HEADER = { 'x-admin-key': import.meta.env.VITE_ADMIN_API_KEY || '' }

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/admin/gmail/status`, { headers: ADMIN_HEADER })
      .then(r => r.json()).then(setGmailStatus).catch(()=>{})
    fetch(`${API_BASE_URL}/api/admin/audit/logs?limit=25`, { headers: ADMIN_HEADER })
      .then(r => r.json()).then(d => setAuditRows(d.rows||[])).catch(()=>{})
  }, [])

  async function sendWeatherAlert(){
    setStatus('Sending weather alerts…')
    try {
      const r = await fetch(`${API_BASE_URL}/api/admin/weather/alert`, {
        method:'POST',
        headers: { 'Content-Type':'application/json', ...ADMIN_HEADER },
        body: JSON.stringify({ date })
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'failed')
      setStatus(`Triggered for ${j.date}`)
    } catch (e) {
      setStatus('Failed to trigger')
    }
  }

  async function clearGmail(){
  try {
    const r = await fetch(`${API_BASE_URL}/api/admin/gmail/clear`, { method:'POST', headers: ADMIN_HEADER })
    if (!r.ok) throw new Error('failed')
    alert('Gmail token cleared. System will fall back to .env token if set.')
    // refresh status & audit
    fetch(`${API_BASE_URL}/api/admin/gmail/status`, { headers: ADMIN_HEADER })
      .then(r => r.json()).then(setGmailStatus).catch(()=>{})
    fetch(`${API_BASE_URL}/api/admin/audit/logs?limit=25`, { headers: ADMIN_HEADER })
      .then(r => r.json()).then(d => setAuditRows(d.rows||[])).catch(()=>{})
  } catch(e){ alert('Failed to clear token') }
}
  async function rotateGmail(){
    try {
      const r = await fetch(`${API_BASE_URL}/api/admin/gmail/rotate/start`, { headers: ADMIN_HEADER })
      const j = await r.json()
      if (j.url) window.location.href = j.url
    } catch(e){
      alert('Failed to start Gmail rotation')
    }
  }

  return (
    <div className="container" style={{paddingTop:24, paddingBottom:40}}>
      <h2>Admin</h2>
      <div className="card">
        <h3 style={{marginTop:0}}>Weather Tools</h3>
        <div style={{display:'flex', gap:12, alignItems:'center'}}>
          <label>Date <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{marginLeft:8, padding:8}}/></label>
          <button className="btn btn-primary" onClick={sendWeatherAlert}>Send Rain Alerts</button>
          <div>{status}</div>
        </div>
      </div>

      <div className="card" style={{marginTop:16}}>
        <h3 style={{marginTop:0}}>Email (Gmail) Setup</h3>
        <p>Token status: {gmailStatus?.hasToken ? '✅ Set' : '⚠️ Missing'}</p>
        <button className="btn btn-outline" onClick={rotateGmail}>Rotate Gmail Token</button>
        <div style={{fontSize:12, color:'#64748b', marginTop:8}}>
          After consenting with Google, you’ll be redirected back and we’ll store the new token securely.
        </div>
      
<div className="card" style={{marginTop:16}}>
  <h3 style={{marginTop:0}}>Email (Gmail) Setup</h3>
  <p>Token status: {gmailStatus?.hasToken ? '✅ Set' : '⚠️ Missing'}</p>
  <div style={{display:'flex', gap:12, alignItems:'center'}}>
    <button className="btn btn-outline" onClick={rotateGmail}>Rotate Gmail Token</button>
    <button className="btn btn-outline" onClick={clearGmail}>Clear Gmail Token</button>
  </div>
  <div style={{fontSize:12, color:'#64748b', marginTop:8}}>
    After consenting with Google, you’ll be redirected back and we’ll store the new token securely.
  </div>
</div>

<div className="card" style={{marginTop:16}}>
  <h3 style={{marginTop:0}}>Audit Log</h3>
  {auditRows.length===0 ? <div>No entries yet.</div> : (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%', borderCollapse:'collapse'}}>
        <thead>
          <tr><th style={{textAlign:'left'}}>Time</th><th>Actor</th><th>Action</th><th>Detail</th></tr>
        </thead>
        <tbody>
          {auditRows.map((r,idx)=>(
            <tr key={idx}>
              <td>{r.ts}</td>
              <td>{r.actor}</td>
              <td>{r.action}</td>
              <td>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>

    </div>
  )
}
