// components/DifficultySelect.jsx
import React from 'react';
import './DifficultySelect.css';

const difficulties = [
  { level: 'easy',   label: 'Oson',   color: '#10b981', emoji: '😊' },
  { level: 'medium', label: 'O‘rta',  color: '#f59e0b', emoji: '😐' },
  { level: 'hard',   label: 'Qiyin',  color: '#ef4444', emoji: '😈' },
];

export default function DifficultySelect({ onSelect, onBack }) {
  return (
    <main className="difficulty-screen">
      <h1 className="screen-title">Darajani tanlang</h1>
      <p className="screen-subtitle">Qaysi darajada sinab ko‘rmoqchisiz?</p>

      <div className="difficulty-options">
        {difficulties.map(({ level, label, color, emoji }) => (
          <button
            key={level}
            className={`difficulty-btn ${level}`}
            onClick={() => onSelect(level)}
            style={{ '--diff-color': color }}
          >
            <span className="emoji">{emoji}</span>
            <span className="label">{label}</span>
          
          </button>
        ))}
      </div>

      <button className="back-button" onClick={onBack}>
        ← Orqaga
      </button>
    </main>
  );
}