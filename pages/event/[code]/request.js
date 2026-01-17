import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/router';

export default function RequestForm() {
  const router = useRouter();
  const { code } = router.query;
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    song: '',
    artist: '',
    message: '',
    tier: 'standard'
  });

  useEffect(() => {
    if (code) {
      loadEvent();
    }
  }, [code]);

  const loadEvent = async () => {
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
      setLoading(false);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Get price based on tier
      let amount = event.standard_price;
      if (formData.tier === 'skip_3') amount = event.skip_3_price;
      if (formData.tier === 'play_next') amount = event.play_next_price;

      // Insert request into database
      const { data, error: insertError } = await supabase
        .from('requests')
        .insert([
          {
            event_id: event.id,
            requester_name: formData.name,
            requester_email: formData.email || null,
            song: formData.song,
            artist: formData.artist,
            message: formData.message || null,
            tier: formData.tier,
            amount: amount,
            payment_status: 'pending',
            request_status: 'pending',
            queue_position: 999
          }
        ])
        .select();

      if (insertError) throw insertError;

      // Success - redirect to queue
      router.push(`/event/${code}?submitted=true`);

    } catch (err) {
      setError(err.message);
      setSubmitting(false);
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
          <h2 style={{ color: '#ff6b35' }}>Event Not Found</h2>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0b0b0d 0%, #1a1a2e 100%)',
      color: '#eef',
      padding: '20px',
      fontFamily: '-apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        <div style={{ marginBottom: '30px' }}>
          <button
            onClick={() => router.push(`/event/${code}`)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#00f5ff',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '0',
              marginBottom: '20px'
            }}
          >
            ← Back to Queue
          </button>
          
          <h1 style={{ 
            color: '#ff6b35',
            margin: '0 0 10px 0',
            fontSize: '32px'
          }}>
            🎤 Request a Song
          </h1>
          <p style={{ 
            color: 'rgba(255,255,255,0.6)',
            margin: '0',
            fontSize: '14px'
          }}>
            {event.event_name} • {event.venue}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '25px',
            marginBottom: '20px'
          }}>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: 'rgba(255,255,255,0.8)',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Your Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Sarah"
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: 'rgba(255,255,255,0.8)',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Email (Optional)
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="sarah@example.com"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '16px'
                }}
              />
              <p style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.5)',
                marginTop: '6px'
              }}>
                For payment confirmation notifications
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: 'rgba(255,255,255,0.8)',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Song Title *
              </label>
              <input
                type="text"
                name="song"
                value={formData.song}
                onChange={handleChange}
                placeholder="Sandstorm"
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: 'rgba(255,255,255,0.8)',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Artist *
              </label>
              <input
                type="text"
                name="artist"
                value={formData.artist}
                onChange={handleChange}
                placeholder="Darude"
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ marginBottom: '0' }}>
              <label style={{
                display: 'block',
                color: 'rgba(255,255,255,0.8)',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Special Message (Optional)
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Happy birthday! 🎉"
                rows={3}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '16px',
                  resize: 'vertical',
                  fontFamily: '-apple-system, sans-serif'
                }}
              />
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '25px',
            marginBottom: '20px'
          }}>
            <h3 style={{ 
              color: '#fff',
              marginBottom: '15px',
              fontSize: '18px'
            }}>
              Select Tier
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <label style={{
                display: 'flex',
                alignItems: 'center',
                padding: '15px',
                background: formData.tier === 'standard' ? 'rgba(0,245,255,0.1)' : 'rgba(255,255,255,0.03)',
                border: formData.tier === 'standard' ? '2px solid #00f5ff' : '2px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
                <input
                  type="radio"
                  name="tier"
                  value="standard"
                  checked={formData.tier === 'standard'}
                  onChange={handleChange}
                  style={{ marginRight: '12px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                    Standard Request
                  </div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                    Added to queue
                  </div>
                </div>
                <div style={{ 
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#00f5ff'
                }}>
                  ${event.standard_price}
                </div>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                padding: '15px',
                background: formData.tier === 'skip_3' ? 'rgba(255,0,110,0.1)' : 'rgba(255,255,255,0.03)',
                border: formData.tier === 'skip_3' ? '2px solid #ff006e' : '2px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
                <input
                  type="radio"
                  name="tier"
                  value="skip_3"
                  checked={formData.tier === 'skip_3'}
                  onChange={handleChange}
                  style={{ marginRight: '12px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                    Skip 3 Songs
                  </div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                    Move up in the queue
                  </div>
                </div>
                <div style={{ 
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#ff006e'
                }}>
                  ${event.skip_3_price}
                </div>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                padding: '15px',
                background: formData.tier === 'play_next' ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.03)',
                border: formData.tier === 'play_next' ? '2px solid #00ff88' : '2px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
                <input
                  type="radio"
                  name="tier"
                  value="play_next"
                  checked={formData.tier === 'play_next'}
                  onChange={handleChange}
                  style={{ marginRight: '12px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                    Play Next ⚡
                  </div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                    Plays after current song
                  </div>
                </div>
                <div style={{ 
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#00ff88'
                }}>
                  ${event.play_next_price}
                </div>
              </label>
            </div>

            <div style={{
              marginTop: '15px',
              padding: '12px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.6)'
            }}>
              ℹ️ Payment held until DJ approves your request
            </div>
          </div>

          {error && (
            <div style={{
              padding: '15px',
              background: 'rgba(255,0,0,0.1)',
              border: '1px solid rgba(255,0,0,0.3)',
              borderRadius: '8px',
              color: '#ff6b6b',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '16px',
              background: submitting 
                ? 'rgba(255,255,255,0.1)' 
                : 'linear-gradient(135deg, #ff006e, #ff4d8f)',
              color: submitting ? 'rgba(255,255,255,0.5)' : 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: submitting ? 'none' : '0 0 30px rgba(255,0,110,0.5)'
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Request (Free for Testing)'}
          </button>

          <p style={{
            textAlign: 'center',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
            marginTop: '15px'
          }}>
            Stripe payment integration coming next
          </p>
        </form>
      </div>
    </div>
  );
}
