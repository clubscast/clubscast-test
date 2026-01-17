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
      
      const interval = setInterval(loadEventAndRequests, 10000);
      return () => clearInterval(interval);
    }
  }, [code]);

  const loadEventAndRequests = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('event_code', code)
        .single();

      if (eventError) throw eventError;
      if (!eventData) {
        setError('Event not found');
        setLoading(false);
        return;
      }

      setEvent(eventData);

     const { data } = await supabase
    .from('requests')
    .select('*')
    .eq('event_id', event.id)
    .eq('request_status', 'pending')
    .order('submitted_at', { ascending: true });

      setRequests(requestsData || []);
      setLoading(false);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0b0b0d 0%, #1a1a2e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontFamily: '-apple-system, sans-serif'
      }}>
        Loading...
      </div>
    );
  }

  if (error || !event) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0b0b0d 0%, #1a1a2e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontFamily: '-apple-system, sans-serif',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div>
          <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>😕</h1>
          <h2 style={{ color: '#ff6b35', marginBottom: '10px' }}>Event Not Found</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>
            {error || 'This event does not exist'}
          </p>
        </div>
      </div>
    );
  }

  const nowPlaying = requests.find(r => r.request_status === 'playing');
  const upNext = requests.filter(r => r.request_status === 'approved');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0b0b0d 0%, #1a1a2e 100%)',
      color: '#eef',
      padding: '20px',
      fontFamily: '-apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <div style={{ 
          textAlign: 'center',
          marginBottom: '40px',
          paddingBottom: '30px',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h1 style={{ 
            color: '#ff6b35',
            margin: '0 0 10px 0',
            fontSize: '36px'
          }}>
            🎵 {event.event_name}
          </h1>
          <p style={{ 
            color: '#aaa',
            margin: '0 0 20px 0',
            fontSize: '16px'
          }}>
            📍 {event.venue} • 📅 {new Date(event.event_date).toLocaleDateString()}
          </p>
          
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
              boxShadow: '0 0 30px rgba(255,0,110,0.5)'
            }}
          >
            Request a Song
          </button>
        </div>

        {nowPlaying && (
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ 
              fontSize: '20px',
              marginBottom: '15px',
              color: '#fff'
            }}>
               Now Playing
            </h2>
            <div style={{
              background: 'rgba(0,255,136,0.08)',
              borderLeft: '4px solid #00ff88',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 0 20px rgba(0,255,136,0.2)'
            }}>
              <div style={{ 
                fontSize: '22px',
                fontWeight: '700',
                marginBottom: '8px',
                color: '#fff'
              }}>
                {nowPlaying.song}
              </div>
              <div style={{ 
                fontSize: '18px',
                opacity: 0.9,
                marginBottom: '10px',
                color: '#00ff88'
              }}>
                {nowPlaying.artist}
              </div>
              <div style={{ 
                fontSize: '14px',
                opacity: 0.7
              }}>
                 Requested by {nowPlaying.requester_name}
              </div>
              {nowPlaying.message && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontStyle: 'italic',
                  color: 'rgba(255,255,255,0.8)'
                }}>
                   "{nowPlaying.message}"
                </div>
              )}
            </div>
          </div>
        )}

        {upNext.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ 
              fontSize: '20px',
              marginBottom: '15px',
              color: '#fff'
            }}>
              ⏭️ Up Next ({upNext.length})
            </h2>
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {upNext.slice(0, 10).map((request, index) => (
                <div
                  key={request.id}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderLeft: '4px solid #ff6b35',
                    borderRadius: '12px',
                    padding: '16px',
                    transition: 'transform 0.2s'
                  }}
                >
                  <div style={{ 
                    fontSize: '18px',
                    fontWeight: '600',
                    marginBottom: '6px',
                    color: '#fff'
                  }}>
                    {index + 1}. {request.song}
                  </div>
                  <div style={{ 
                    fontSize: '16px',
                    opacity: 0.9,
                    marginBottom: '8px',
                    color: '#00f5ff'
                  }}>
                    {request.artist}
                  </div>
                  <div style={{ 
                    fontSize: '13px',
                    opacity: 0.7,
                    display: 'flex',
                    gap: '15px',
                    flexWrap: 'wrap'
                  }}>
                    <span>👤 {request.requester_name}</span>
                    {request.tier !== 'standard' && (
                      <span style={{ 
                        color: '#ff006e',
                        fontWeight: '600'
                      }}>
                        ⚡ {request.tier === 'skip_3' ? 'Skip 3' : 'Play Next'}
                      </span>
                    )}
                  </div>
                  {request.message && (
                    <div style={{
                      marginTop: '10px',
                      padding: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontStyle: 'italic',
                      color: 'rgba(255,255,255,0.7)'
                    }}>
                      💬 "{request.message}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!nowPlaying && upNext.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            opacity: 0.5
          }}>
            <h2 style={{ 
              fontSize: '48px',
              marginBottom: '20px'
            }}>
              
            </h2>
            <h3 style={{ 
              fontSize: '24px',
              marginBottom: '10px',
              color: '#fff'
            }}>
              No requests yet!
            </h3>
            <p style={{ 
              color: 'rgba(255,255,255,0.6)'
            }}>
              Be the first to request a song
            </p>
          </div>
        )}

        <div style={{
          marginTop: '60px',
          textAlign: 'center',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          opacity: 0.4,
          fontSize: '12px'
        }}>
          ClubsCast Queue • Auto-refresh every 10s
        </div>
      </div>
    </div>
  );
}
