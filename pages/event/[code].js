import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/router';

export default function EventQueue() {
  const router = useRouter();
  const { code } = router.query;
  
  const [event, setEvent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (code) {
      loadEventAndRequests();
    }
  }, [code]);

  useEffect(() => {
    if (event) {
      const interval = setInterval(loadRequests, 5000);
      return () => clearInterval(interval);
    }
  }, [event]);

  const loadEventAndRequests = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('event_code', code)
        .single();

      if (eventError) throw eventError;
      
      setEvent(eventData);
      await loadRequests(eventData.id);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const loadRequests = async (eventId = event?.id) => {
    if (!eventId) return;

    const { data } = await supabase
      .from('requests')
      .select('*')
      .eq('event_id', eventId)
      .eq('request_status', 'pending')
      .order('submitted_at', { ascending: true });

    setRequests(data || []);
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

  if (error || !event) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0b0b0d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,0,0,0.3)',
          padding: '40px',
          borderRadius: '20px',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h1 style={{ color: '#ff6b6b', marginBottom: '10px' }}>
            Event Not Found
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>
            {error || 'This event code is invalid or has been deleted.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0b0b0d 0%, #1a0a1f 100%)',
      color: '#eef',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
          paddingTop: '20px'
        }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #ff006e, #00f5ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '10px'
          }}>
            {event.event_name}
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: '16px',
            marginBottom: '5px'
          }}>
            {event.venue}
          </p>
          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '14px'
          }}>
            {new Date(event.event_date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        {/* Request Button */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px'
        }}>
          <button
            onClick={() => router.push(`/event/${code}/request`)}
            style={{
              padding: '16px 40px',
              background: 'linear-gradient(135deg, #ff006e, #ff4d8f)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(255,0,110,0.4)',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            Request a Song
          </button>
        </div>

        {/* Queue Section */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '30px',
          backdropFilter: 'blur(10px)'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '700',
            marginBottom: '20px',
            color: '#00f5ff',
            textAlign: 'center'
          }}>
            Song Queue
          </h2>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {requests.length === 0 ? (
              <p style={{
                textAlign: 'center',
                color: 'rgba(255,255,255,0.4)',
                padding: '40px 20px',
                fontSize: '16px'
              }}>
                No songs in queue yet. Be the first to request!
              </p>
            ) : (
              requests.map((request, index) => (
                <div
                  key={request.id}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '18px',
                    borderRadius: '12px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '15px'
                  }}>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#00f5ff',
                      minWidth: '30px'
                    }}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        marginBottom: '5px',
                        color: '#fff'
                      }}>
                        {request.song}
                      </div>
                      <div style={{
                        fontSize: '15px',
                        color: 'rgba(255,255,255,0.7)',
                        marginBottom: '8px'
                      }}>
                        {request.artist}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.5)'
                      }}>
                        Requested by {request.requester_name}
                      </div>
                      {request.message && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontStyle: 'italic',
                          color: 'rgba(255,255,255,0.6)'
                        }}>
                          "{request.message}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '40px',
          paddingBottom: '20px'
        }}>
          <p style={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: '14px'
          }}>
            Powered by ClubsCast
          </p>
        </div>
      </div>
    </div>
  );
}
