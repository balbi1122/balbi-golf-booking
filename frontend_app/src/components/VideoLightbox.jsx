import React from 'react'

export default function VideoLightbox({ open, onClose, youtubeId }){
  if(!open) return null
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-inner" onClick={(e)=>e.stopPropagation()}>
        <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
      </div>
    </div>
  )
}
