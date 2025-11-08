// frontend/src/components/Stars.jsx
import React from 'react';

export default function Stars({ value = 0, max = 5 }) {
  const fullStars = Math.floor(value);
  const hasHalf = value % 1 >= 0.5;
  const emptyStars = max - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="stars-rating">
      {[...Array(fullStars)].map((_, i) => (
        <span key={`full-${i}`} className="star full">★</span>
      ))}
      {hasHalf && (
        <span className="star half">
          <span className="half-star">★</span>
        </span>
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <span key={`empty-${i}`} className="star empty">☆</span>
      ))}
    </div>
  );
}