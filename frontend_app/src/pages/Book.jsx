import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL, PRICES } from '../config.js'

export default function Book(){
  const [date, setDate] = useState(()=> new Date().toISOString().slice(0,10))
  const [duration, setDuration] = useState(60)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedStart, setSelectedStart] = useState('')
  const [student, setStudent] = useState({ name:'', email:'', phone:'', address:'' })
  const [paymentType, setPaymentType] = useState('card')
  const [message, setMessage] = useState('')

  useEffect(()=>{
    async function fetchSlots(){
      setLoading(true)
      setSelectedStart('')
      try {
        const r = await fetch(`${API_BASE_URL}/api/availability?date=${date}&duration=${duration}`)
        const j = await r.json()
        setSlots(j.slots || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchSlots()
  }, [date, duration])

  const price = useMemo(()=>{
    let base = PRICES[duration] || 0
    if (paymentType === 'cash'){
      base = Math.round(base * (1 - 0.11))
    }
    return base
  }, [duration, paymentType])

  async function submit(){
    setMessage('')
    try {
      if (!selectedStart) return setMessage('Pick a time first.')
      const iso = new Date(selectedStart).toISOString()
      const time = iso.slice(11,16)
      const body = { date, time, duration, student, payment_type: paymentType }
      const r = await fetch(`${API_BASE_URL}/api/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const j = await r.json()
      if (!r.ok) {
        return setMessage(j.error || 'Booking failed.')
      }
      setMessage('Booking confirmed! Check your email for confirmation.')
    } catch (e) {
      console.error(e)
      setMessage('Something went wrong.')
    }
  }

  return (
    <div className="container" style={{paddingTop:24, paddingBottom:40}}>
      <h2>Book a lesson</h2>

      <div className="grid">
        <div style={{gridColumn:'span 7'}}>
          <div className="card">
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <label>Lesson date
                <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{display:'block', padding:10, width:'100%', marginTop:6}}/>
              </label>
              <label>Duration
                <select value={duration} onChange={e=>setDuration(parseInt(e.target.value))} style={{display:'block', padding:10, width:'100%', marginTop:6}}>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </label>
            </div>

            <div style={{marginTop:16}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <strong>Available times</strong>
                {loading && <span className="badge">Loading…</span>}
              </div>
              <div style={{display:'grid', gap:8, gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', marginTop:8}}>
                {(slots||[]).map(s => (
                  <button key={s.start} onClick={()=>setSelectedStart(s.start)}
                    className="btn btn-outline"
                    style={{ background: selectedStart===s.start ? '#10b981' : 'white', color: selectedStart===s.start ? '#0b0c10' : undefined }}>
                    {s.label}
                  </button>
                ))}
                {(!slots || slots.length===0) && <div>No times available.</div>}
              </div>
            </div>
          </div>

          <div className="card" style={{marginTop:16}}>
            <h3 style={{marginTop:0}}>Your info</h3>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <label>Full name
                <input value={student.name} onChange={e=>setStudent({...student, name:e.target.value})} style={{display:'block', padding:10, width:'100%', marginTop:6}}/>
              </label>
              <label>Email
                <input value={student.email} onChange={e=>setStudent({...student, email:e.target.value})} style={{display:'block', padding:10, width:'100%', marginTop:6}}/>
              </label>
              <label>Phone
                <input value={student.phone} onChange={e=>setStudent({...student, phone:e.target.value})} style={{display:'block', padding:10, width:'100%', marginTop:6}}/>
              </label>
              <label>Address
                <input value={student.address} onChange={e=>setStudent({...student, address:e.target.value})} style={{display:'block', padding:10, width:'100%', marginTop:6}}/>
              </label>
            </div>
          </div>
        </div>

        <div style={{gridColumn:'span 5'}}>
          <div className="card">
            <div style={{display:'flex', justifyContent:'space-between'}}>
              <div>Lesson price</div>
              <div><strong>${price}</strong></div>
            </div>
            <div style={{marginTop:8}}>
              <label>Payment method</label><br/>
              <label style={{marginRight:12}}><input type="radio" name="pay" value="card" checked={paymentType==='card'} onChange={()=>setPaymentType('card')}/> Card</label>
              <label style={{marginRight:12}}><input type="radio" name="pay" value="cash" checked={paymentType==='cash'} onChange={()=>setPaymentType('cash')}/> Cash (11% off)</label>
              <label><input type="radio" name="pay" value="prepaid" checked={paymentType==='prepaid'} onChange={()=>setPaymentType('prepaid')}/> Prepaid hours</label>
            </div>

            <button className="btn btn-primary" style={{marginTop:16, width:'100%'}} onClick={submit}>Confirm booking</button>
            {message && <div style={{marginTop:12}}>{message}</div>}

            <div style={{marginTop:14, fontSize:12, color:'#64748b'}}>
              <strong>Cancellation Policy:</strong> Cancellations made less than 24 hours before the scheduled lesson may be subject to a fee.
              Weather-related changes have no fee.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
