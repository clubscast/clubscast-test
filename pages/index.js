
export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '60px 40px',
        borderRadius: '20px',
        textAlign: 'center',
        maxWidth: '600px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{
          fontSize: '48px',
          margin: '0 0 20px 0',
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          🎵 ClubsCast
        </h1>
        <p style={{
          fontSize: '24px',
          color: '#666',
          marginBottom: '30px'
        }}>
          DJ Song Request System
        </p>
        <p style={{
          fontSize: '16px',
          color: '#999',
          marginBottom: '40px'
        }}>
          Test deployment successful! ✅
        </p>
        <div style={{
          display: 'flex',
          gap: '15px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <a href="/dashboard" style={{
            padding: '14px 30px',
            background: '#667eea',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '10px',
            fontWeight: '600'
          }}>
            DJ Dashboard
          </a>
          <a href="/test-event" style={{
            padding: '14px 30px',
            background: '#764ba2',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '10px',
            fontWeight: '600'
          }}>
            View Test Event
          </a>
        </div>
      </div>
    </div>
  );
}
