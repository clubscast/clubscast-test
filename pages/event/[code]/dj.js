import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/router';

export default function DJPanel() {
  const router = useRouter();
  const { code } = router.query;
  
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [event, setEvent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (code) {
      loadEvent();
    }
  }, [code]);

  useEffect(() => {
    if (authenticated && event) {
      loadRequests();
      const interval = setInterval(loadRequests, 5000);
      return () => clearInterval(interval);
    }
  }, [authenticated, event]);

  const loadEvent = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('event_code', code)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    if (!event) return;

    const { data } = await supabase
      .from('requests')
      .select('*')
      .eq('event_id', event.id)
      .order('submitted_at', { ascending: true });

    setRequests(data || []);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === event.dj_password) {
      setAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect password');
    }
  };

  const handleApprove = async (requestId) => {
    const { error } = await supabase
      .from('requests')
      .update({ 
        request_status: 'approved',
        payment_status: 'captured'
      })
      .eq('id', requestId);

    if (!error) loadRequests();
  };

  const handleReject = async (requestId) => {
    const { error } = await supabase
      .from('requests')
      .update({ 
        request_status: 'rejected',
        payment_status: 'cancelled',
        rejection_reason: 'Song not available'
      })
      .eq('id', requestId);

    if (!error) loadRequests();
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0b0b0d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        Loading...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0b0b0d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: '-apple-system, sans-serif'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,0,110,0.2)',
          padding: '40px',
          borderRadius: '20px',
          maxWidth: '400px',
          width: '100%'
        }}>
          <h1 style={{ 
            color: '#ff6b35',
            marginBottom: '10px',
            textAlign: 'center'
          }}>
            🎛️ DJ Control Panel
          </h1>
          <p style={{ 
            color: 'rgba(255,255,255,0.6)',
            textAlign: 'center',
            marginBottom: '30px',
            fontSize: '14px'
          }}>
            {event?.event_name}
          </p>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter DJ password"
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '16px',
                marginBottom: '15px'
              }}
            />
            {error && (
              <p style={{ 
                color: '#ff6b6b',
                fontSize: '14px',
                marginBottom: '15px'
              }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #ff006e, #ff4d8f)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Access Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  const pending = requests.filter(r => r.request_status === 'pending');
  const approved = requests.filter(r => r.request_status === 'approved');
  const rejected = requests.filter(r => r.request_status === 'rejected');

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0b0d',
      color: '#eef',
      padding: '20px',
      fontFamily: '-apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div>
            <h1 style={{ 
              color: '#ff6b35',
              margin: '0 0 5px 0',
              fontSize: '28px'
            }}>
              🎛️ DJ Control Panel
            </h1>
            <p style={{ 
              color: '#aaa',
              margin: '0',
              fontSize: '14px'
            }}>
              {event.event_name} • {event.venue}
            </p>
          </div>
          <button
            onClick={() => router.push(`/event/${code}`)}
            style={{
              padding: '10px 20px',
              background: 'rgba(0,245,255,0.2)',
              color: '#00f5ff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            View Queue
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '20px'
        }}>
          
          {/* Pending Requests */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,0,110,0.2)',
            borderRadius: '12px',
            padding: '20px',
            gridColumn: 'span 2'
          }}>
            <h2 style={{ 
              fontSize: '18px',
              marginBottom: '15px',
              color: '#ff006e'
            }}>
              🎵 Song Requests ({pending.length})
            </h2>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '12px',
              maxHeight: '600px',
              overflowY: 'auto'
            }}>
              {pending.map(request => (
                <div
                  key={request.id}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    padding: '15px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <div style={{ 
                    fontWeight: '600',
                    marginBottom: '5px',
                    color: '#fff',
                    fontSize: '16px'
                  }}>
                    {request.song}
                  </div>
                  <div style={{ 
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.7)',
                    marginBottom: '5px'
                  }}>
                    {request.artist}
                  </div>
                  <div style={{ 
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.6)',
                    marginBottom: '10px'
                  }}>
                    👤 {request.requester_name} • ${request.amount}
                  </div>
                  {request.message && (
                    <div style={{
                      fontSize: '13px',
                      fontStyle: 'italic',
                      color: 'rgba(255,255,255,0.6)',
                      marginBottom: '10px',
                      padding: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '6px'
                    }}>
                      💬 "{request.message}"
                    </div>
                  )}
                  <div style={{ 
                    display: 'flex',
                    gap: '8px'
                  }}>
                    <button
                      onClick={() => handleApprove(request.id)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: '#00ff88',
                        color: '#0a0a0a',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      ✓ Played
                    </button>
                    <button
                      onClick={() => handleReject(request.id)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: 'rgba(255,0,0,0.2)',
                        color: '#ff6b6b',
                        border: '1px solid rgba(255,0,0,0.3)',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      ✗ Skip
                    </button>
                  </div>
                </div>
              ))}
              {pending.length === 0 && (
                <p style={{ 
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.4)',
                  padding: '20px',
                  gridColumn: '1 / -1'
                }}>
                  No pending requests
                </p>
              )}
            </div>
          </div>

          {/* History */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h2 style={{ 
              fontSize: '18px',
              marginBottom: '15px',
              color: '#aaa'
            }}>
              📋 History
            </h2>
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '600px',
              overflowY: 'auto'
            }}>
              <details>
                <summary style={{ 
                  cursor: 'pointer',
                  padding: '10px',
                  background: 'rgba(0,255,136,0.1)',
                  borderRadius: '8px',
                  marginBottom: '5px',
                  fontSize: '14px',
                  color: '#00ff88'
                }}>
                  ✓ Played ({approved.length})
                </summary>
                {approved.map(request => (
                  <div
                    key={request.id}
                    style={{
                      padding: '10px',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.6)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)'
                    }}
                  >
                    {request.song} - {request.artist}
                  </div>
                ))}
              </details>

              <details>
                <summary style={{ 
                  cursor: 'pointer',
                  padding: '10px',
                  background: 'rgba(255,0,0,0.1)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#ff6b6b'
                }}>
                  ✗ Skipped ({rejected.length})
                </summary>
                {rejected.map(request => (
                  <div
                    key={request.id}
                    style={{
                      padding: '10px',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.6)',
                      borderBottom: '1px solid rgba(255,255,255,0.05)'
                    }}
                  >
                    {request.song} - {request.artist}
                  </div>
                ))}
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
