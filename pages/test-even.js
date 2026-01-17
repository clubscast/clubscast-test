export default function TestEvent() {
  const mockRequests = [
    { song: 'Sandstorm', artist: 'Darude', requester: 'Sarah' },
    { song: 'September', artist: 'Earth, Wind & Fire', requester: 'Mike' },
    { song: 'Uptown Funk', artist: 'Bruno Mars', requester: 'Jessica' }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0b0b0d 0%, #1a1a2e 100%)',
      color: '#eef',
      padding: '20px',
      fontFamily: '-apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ color: '#ff6b35', marginBottom: '10px', fontSize: '32px' }}>
          🎵 DJ Test Queue
        </h1>
        <p style={{ color: '#aaa', marginBottom: '30px', fontSize: '14px' }}>
          Test Event • Demo Venue
        </p>

        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '15px' }}>
            ▶️ Now Playing
          </h2>
          <div style={{
            background: 'rgba(0,255,136,0.08)',
            borderLeft: '4px solid #00ff88',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '6px' }}>
              {mockRequests[0].song}
            </div>
            <div style={{ fontSize: '15px', opacity: 0.9, marginBottom: '8px' }}>
              {mockRequests[0].artist}
            </div>
            <div style={{ fontSize: '13px', opacity: 0.7 }}>
              👤 {mockRequests[0].requester}
            </div>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', marginBottom: '15px' }}>
            ⏭️ Up Next ({mockRequests.length - 1})
          </h2>
          {mockRequests.slice(1).map((request, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.05)',
              borderLeft: '4px solid #ff6b35',
              borderRadius: '12px',
              padding: '18px',
              marginBottom: '12px',
              transition: 'transform 0.2s'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '6px' }}>
                {i + 1}. {request.song}
              </div>
              <div style={{ fontSize: '15px', opacity: 0.9, marginBottom: '8px' }}>
                {request.artist}
              </div>
              <div style={{ fontSize: '13px', opacity: 0.7 }}>
                👤 {request.requester}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: '40px',
          textAlign: 'center',
          padding: '30px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '15px'
        }}>
          <button style={{
            padding: '16px 40px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer'
          }}>
            Request a Song
          </button>
          <p style={{ marginTop: '20px', fontSize: '14px', opacity: 0.5 }}>
            (Request form coming in next step)
          </p>
        </div>

        <div style={{
          marginTop: '50px',
          textAlign: 'center',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          opacity: 0.4,
          fontSize: '12px'
        }}>
          <a href="/" style={{ color: '#667eea', textDecoration: 'none' }}>
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
