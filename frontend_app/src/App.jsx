import React from 'react'
import { Routes, Route, Link, NavLink } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Book from './pages/Book.jsx'
import Admin from './pages/Admin.jsx'

export default function App(){
  return (
    <div>
      <header>
        <div className="container" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{fontWeight:800, letterSpacing:'0.2px'}}>Balbi Golf</div>
          <nav>
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/book" style={{marginLeft:12}}>Book</NavLink>
            <NavLink to="/admin" style={{marginLeft:12}}>Admin</NavLink>
          </nav>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/book" element={<Book/>} />
        <Route path="/admin" element={<Admin/>} />
      </Routes>
      <footer className="footer">
        <div className="container">© {new Date().getFullYear()} Balbi Golf • Oceanview Driving Range, Half Moon Bay</div>
      </footer>
    </div>
  )
}
