export default function Dashboard() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0b0d',
      color: '#eef',
      padding: '40px 20px',
      fontFamily: '-apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h1 style={{ color: '#ff6b35', marginBottom: '30px' }}>
          DJ Dashboard
        </h1>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          padding: '40px',
          borderRadius: '15px',
          textAlign: 'center'
        }}>
          <h2 style={{ marginBottom: '20px' }}>Coming Soon!</h2>
          <p style={{ opacity: 0.7, marginBottom: '30px' }}>
            This is where you'll create and manage your events.
          </p>
          <a href="/" style={{
            display: 'inline-block',
            padding: '14px 30px',
            background: '#667eea',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '10px',
            fontWeight: '600'
          }}>
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
