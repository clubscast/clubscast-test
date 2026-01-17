import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [djProfile, setDjProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
      return;
    }

    setUser(user);

    // Get DJ profile
    const { data: profile } = await supabase
      .from('djs')
      .select('*')
      .eq('id', user.id)
      .single();

    setDjProfile(profile);

    // Get DJ's events
    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .eq('dj_id', user.id)
      .order('created_at', { ascending: false });

    setEvents(eventsData || []);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
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

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0b0d',
      color: '#eef',
      padding: '20px',
      fontFamily: '-apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '40px',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div>
            <h1 style={{ 
              color: '#ff6b35', 
              margin: '0 0 5px 0',
              fontSize: '32px'
            }}>
              Welcome, {djProfile?.dj_name}!
            </h1>
            <p style={{ 
              color: '#aaa', 
              margin: '0',
              fontSize: '14px'
            }}>
              {user?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Logout
          </button>
        </div>

        {/* Create Event Button */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,0,110,0.2)',
          borderRadius: '15px',
          padding: '30px',
          marginBottom: '30px',
          textAlign: 'center'
        }}>
          <h2 style={{ marginBottom: '15px', color: '#fff' }}>
            Create Your First Event
          </h2>
          <p style={{ 
            color: 'rgba(255,255,255,0.6)', 
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            Set up a new event to start receiving song requests
          </p>
          
            href="/create-event"
            style={{
              display: 'inline-block',
              padding: '14px 40px',
              background: 'linear-gradient(135deg, #ff006e, #ff4d8f)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '16px'
            }}
          >
            + Create Event
          </a>
        </div>

        {/* Events List */}
        <div>
          <h2 style={{ 
            marginBottom: '20px',
            fontSize: '24px',
            color: '#fff'
          }}>
            Your Events ({events.length})
          </h2>

          {events.length === 0 ? (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.5)'
            }}>
              No events yet. Create your first event to get started!
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gap: '20px',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
            }}>
              {events.map(event => (
                <div
                  key={event.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(0,245,255,0.2)',
                    borderRadius: '12px',
                    padding: '20px',
                    transition: 'transform 0.2s'
                  }}
                >
                  <h3 style={{ 
                    color: '#00f5ff',
                    marginBottom: '10px',
                    fontSize: '18px'
                  }}>
                    {event.event_name}
                  </h3>
                  <p style={{ 
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '14px',
                    marginBottom: '5px'
                  }}>
                    📍 {event.venue}
                  </p>
                  <p style={{ 
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '14px',
                    marginBottom: '15px'
                  }}>
                    📅 {new Date(event.event_date).toLocaleDateString()}
                  </p>
                  <div style={{
                    display: 'flex',
                    gap: '10px',
                    flexWrap: 'wrap'
                  }}>
                    
                      href={`/event/${event.event_code}`}
                      target="_blank"
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(0,245,255,0.2)',
                        color: '#00f5ff',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      View Queue
                    </a>
                    
                      href={`/event/${event.event_code}/dj`}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(255,0,110,0.2)',
                        color: '#ff006e',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      DJ Panel
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
