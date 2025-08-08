import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import VideoLightbox from '../components/VideoLightbox.jsx'
import { LOCATION_NAME, GOOGLE_MAPS_LINK } from '../config.js'

export default function Home(){
  const [open, setOpen] = useState(false)
  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="grid">
            <div style={{gridColumn:'span 7'}}>
              <div className="badge">David Balbi, PGA</div>
              <h1 style={{fontSize:48, margin:'10px 0 8px'}}>Private Golf Instruction</h1>
              <p style={{fontSize:18, color:'#334155'}}>One-on-one lessons focused on your swing, tempo, and on-course decision-making. Book online in minutes.</p>
              <div style={{marginTop:18, display:'flex', gap:12}}>
                <Link className="btn btn-primary" to="/book">
                  <span style={{display:'inline-flex', alignItems:'center', gap:8}}>
                    <svg className="icon bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 0 0 2-2V8H3v11a2 2 0 0 0 2 2Z"/></svg>
                    Book a lesson
                  </span>
                </Link>
                <button className="btn btn-outline" onClick={()=>setOpen(true)}>Watch video</button>
              </div>
              <div style={{marginTop:14}}>
                <a href={GOOGLE_MAPS_LINK} target="_blank" rel="noreferrer">
                  <span style={{display:'inline-flex', alignItems:'center', gap:8}}>
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21s-6-4.35-6-9a6 6 0 1 1 12 0c0 4.65-6 9-6 9Z"/><circle cx="12" cy="12" r="2"/></svg>
                    {LOCATION_NAME}
                  </span>
                </a>
              </div>
              <div style={{marginTop:8}}>
                <Link to="/book">Learn more about David</Link>
              </div>
            </div>
            <div style={{gridColumn:'span 5'}}>
              <div className="card">
                <h3 style={{marginTop:0}}>Lesson Options</h3>
                <ul style={{lineHeight:1.9, margin:0, paddingLeft:18}}>
                  <li>30 minutes — $90</li>
                  <li>45 minutes — $135</li>
                  <li>60 minutes — $180</li>
                </ul>
                <div style={{marginTop:10, fontSize:14, color:'#64748b'}}>11% cash discount applied automatically at checkout.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <h2>About David</h2>
          <p>David Balbi is a PGA Class A professional coach. Decades of teaching and coaching players of all levels.</p>
        </div>
      </section>

      <VideoLightbox open={open} onClose={()=>setOpen(false)} youtubeId="LKuvupZSMvA" />
    </>
  )
}
