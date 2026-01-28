import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/router';

export default function DJEvents() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [djId, setDjId] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const storedDjId = sessionStorage.getItem('dj_id');
    const storedPassword = sessionStorage.getItem('dj_password');
    
    if (storedDjId && storedPassword) {
      setDjId(storedDjId);
      setAuthenticated(true);
      loadEvents(storedDjId);
    } else {
      setLoading(false);
    }
  }, []);

  const loadEvents = async (id) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          requests (
            id,
            request_status,
            dj_price
          )
        `)
        .eq('dj_id', id)
        .order('event_date', { ascending: false });

      if (error) throw error;

      const eventsWithStats = data.map(event => {
        const requests = event.requests || [];
        return {
          ...event,
          total_requests: requests.length,
          pending: requests.filter(r => r.request_status === 'pending').length,
          approved: requests.filter(r => r.request_status === 'approved').length,
          rejected: requests.filter(r => r.request_status === 'rejected').length,
          total_earnings: requests
            .filter(r => r.request_status === 'approved')
            .reduce((sum, r) => sum + (r.dj_price || 0), 0)
        };
      });

      setEvents(eventsWithStats);
      setLoading(false);
    } catch (err) {
      console.error('Error loading events:', err);
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const { data: djData, error: djError } = await supabase
        .from('djs')
        .select('id, name')
        .eq('password', password)
        .single();

      if (djError || !djData) {
        setError('Invalid password');
        return;
      }

      sessionStorage.setItem('dj_id', djData.id);
      sessionStorage.setItem('dj_password', password);

      setDjId(djData.id);
      setAuthenticated(true);
      loadEvents(djData.id);
    } catch (err) {
      setError('Error logging in');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('dj_id');
    sessionStorage.removeItem('dj_password');
    setAuthenticated(false);
    setDjId(null);
    setEvents([]);
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
        padding: '20px'
      }}>
        <div style={{
          maxWidth: '400px',
          width: '100%',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,0,110,0.2)',
          padding: '40px',
          borderRadius: '20px'
        }}>
          <h1 style={{ color: '#ff6b35', marginBottom: '20px', textAlign: 'center' }}>
            DJ Login
          </h1>
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
              <p style={{ color: '#ff6b6b', fontSize: '14px', marginBottom: '15px' }}>
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
              Access Events
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0b0d',
      color: '#eef',
      padding: '20px',
      fontFamily: '-apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <h1 style={{ color: '#ff6b35', margin: '0', fontSize: '32px' }}>
            My Events
          </h1>
          <button
            onClick={handleLogout}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,0,0,0.2)',
              color: '#ff6b6b',
              border: '1px solid rgba(255,0,0,0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Logout
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '20px'
        }}>
          {events.map(event => {
            const statusColor = 
              event.accepting_requests === 'ended' ? '#ff6b6b' :
              event.accepting_requests === 'paused' ? '#FFD700' :
              '#00ff88';

            return (
              <div
                key={event.id}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '15px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.borderColor = '#ff006e';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
                onClick={() => router.push(`/dj/events/${event.event_code}`)}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '15px'
                }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{
                      color: 'white',
                      fontSize: '20px',
                      marginBottom: '5px',
                      fontWeight: '700'
                    }}>
                      {event.event_name}
                    </h2>
                    <p style={{
                      color: 'rgba(255,255,255,0.6)',
                      fontSize: '14px',
                      margin: '0'
                    }}>
                      {event.venue}
                    </p>
                  </div>
                  <div style={{
                    padding: '6px 12px',
                    background: `${statusColor}20`,
                    border: `1px solid ${statusColor}`,
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: statusColor
                  }}>
                    {event.accepting_requests === 'ended' ? 'Ended' :
                     event.accepting_requests === 'paused' ? 'Paused' : 'Active'}
                  </div>
                </div>

                <div style={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '13px',
                  marginBottom: '15px'
                }}>
                  {new Date(event.event_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  marginBottom: '15px'
                }}>
                  <div style={{
                    padding: '10px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                      Total Requests
                    </div>
                    <div style={{ color: 'white', fontSize: '24px', fontWeight: '700' }}>
                      {event.total_requests}
                    </div>
                  </div>

                  <div style={{
                    padding: '10px',
                    background: 'rgba(0,255,136,0.1)',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
                      Earnings
                    </div>
                    <div style={{ color: '#00ff88', fontSize: '24px', fontWeight: '700' }}>
                      ${event.total_earnings.toFixed(0)}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}>
                  <div>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Pending: </span>
                    <span style={{ color: '#FFD700', fontWeight: '600' }}>{event.pending}</span>
                  </div>
                  <div>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Played: </span>
                    <span style={{ color: '#00ff88', fontWeight: '600' }}>{event.approved}</span>
                  </div>
                  <div>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Skipped: </span>
                    <span style={{ color: '#ff6b6b', fontWeight: '600' }}>{event.rejected}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {events.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'rgba(255,255,255,0.4)'
          }}>
            <p style={{ fontSize: '18px' }}>No events found</p>
          </div>
        )}
      </div>
    </div>
  );
}
