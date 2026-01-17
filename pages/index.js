export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a1a 50%, #0a1a1a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,0,110,0.2)',
        padding: '60px 40px',
        borderRadius: '20px',
        textAlign: 'center',
        maxWidth: '600px',
        boxShadow: '0 0 60px rgba(255,0,110,0.3)'
      }}>
        
        <div style={{ marginBottom: '30px' }}>
          <img 
            src="/logo.png" 
            alt="ClubsCast"
            style={{
              maxWidth: '300px',
              width: '100%',
              height: 'auto'
            }}
          />
        </div>

        <p style={{
          fontSize: '24px',
          color: '#00f5ff',
          marginBottom: '15px',
          fontWeight: '600'
        }}>
          Remote DJ Events
        </p>
        
        <p style={{
          fontSize: '16px',
          color: 'rgba(255,255,255,0.6)',
          marginBottom: '40px'
        }}>
          Live DJ sets streamed to your private event.
        </p>

        <div style={{
          display: 'flex',
          gap: '15px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <a href="/dashboard" style={{
            padding: '16px 32px',
            background: '#ff006e',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '12px',
            fontWeight: '700'
          }}>
            DJ Dashboard
          </a>
          
          <a href="/test-event" style={{
            padding: '16px 32px',
            background: '#00f5ff',
            color: '#0a0a0a',
            textDecoration: 'none',
            borderRadius: '12px',
            fontWeight: '700'
          }}>
            View Test Event
          </a>
        </div>

        <div style={{
          marginTop: '40px',
          padding: '20px',
          background: 'rgba(0,245,255,0.05)',
          borderRadius: '10px'
        }}>
          <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0'
          }}>
            Powered by Jinkz Music LLC
          </p>
        </div>
      </div>
    </div>
  );
}
