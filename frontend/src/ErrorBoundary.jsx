import React from 'react';

// Biror komponentda xato bo'lsa, oq ekran o'rniga tushunarli xabar ko'rsatadi
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('❌ Ilovada kutilmagan xato:', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24,
        textAlign: 'center', background: '#0c0c0e', color: '#f8f7f4'
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ fontFamily: "'Syne', system-ui, sans-serif", fontWeight: 800, fontSize: 22 }}>
          Nimadir noto'g'ri ketdi
        </div>
        <div style={{ color: '#8d8d99', maxWidth: 280 }}>
          Ilovani qayta yuklang. Tangalaringiz xavfsiz, ular serverda saqlanadi.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#6366f1', color: '#f8f7f4', border: 0, borderRadius: 15,
            padding: '14px 22px', fontWeight: 700, fontSize: 15, cursor: 'pointer', minHeight: 48
          }}
        >
          Qayta yuklash
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
