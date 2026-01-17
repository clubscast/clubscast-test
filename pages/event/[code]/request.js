import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/router';

export default function RequestForm() {
  const router = useRouter();
  const { code } = router.query;
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    requester_name: '',
    song: '',
    artist: '',
    message: '',
    tier: 'tier_1',
    host_code: ''
  });

  const [hostCodeValid, setHostCodeValid] = useState(false);
  const [hostCodeError, setHostCodeError] = useState('');

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
      setEvent(eventData);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const checkHostCode = async () => {
    if (!formData.host_code.trim()) {
      setHostCodeValid(false);
      setHostCodeError('');
      return;
    }

    if (formData.host_code.toUpperCase() === event.host_code && event.host_code_uses_remaining > 0) {
      setHostCodeValid(true);
      setHostCodeError('');
    } else if (formData.host_code.toUpperCase() === event.host_code && event.host_code_uses_remaining === 0) {
      setHostCodeValid(false);
      setHostCodeError('Host code has no remaining uses');
    } else {
      setHostCodeValid(false);
      setHostCodeError('Invalid host code');
    }
  };

  useEffect(() => {
    if (event && event.host_code) {
      checkHostCode();
    }
  }, [formData.host_code, event]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const selectedTier = formData.tier;
      const amount = event[`${selectedTier}_price`];
      const tierName = event[`${selectedTier}_name`];

      const requestData = {
        event_id: event.id,
        requester_name: formData.requester_name,
        song: formData.song,
        artist: formData.artist,
        message: formData.message || null,
        tier_name: tierName,
        amount: (!event.require_payment || hostCodeValid) ? 0 : amount,
        payment_status: (!event.require_payment || hostCodeValid) ? 'free' : 'pending',
        request_status: 'pending',
        used_host_code: hostCodeValid
      };

      const { data, error: insertError } = await supabase
        .from('requests')
        .insert([requestData])
        .select();

      if (insertError) throw insertError;

      // Decrement host code uses if used
      if (hostCodeValid) {
        await supabase
          .from('events')
          .update({ 
            host_code_uses_remaining: event.host_code_uses_remaining - 1 
          })
          .eq('id', event.id);
      }

      setSuccess(true);
      
      setTimeout(() => {
        router.push(`/event/${code}`);
      }, 2000);

    } catch (err) {
      setError(err.message);
    }
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

  if (success) {
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
          background: 'rgba(0,255,136,0.1)',
          border: '2px solid #00ff88',
          padding: '40px',
          borderRadius: '20px',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h1 style={{ 
            color: '#00ff88',
            marginBottom: '15px',
            fontSize: '28px'
          }}>
            Request Submitted!
          </h1>
          <p style={{ 
            color: 'rgba(255,255,255,0.8)',
            marginBottom: '10px'
          }}>
            Your song has been added to the queue.
          </p>
          <p style={{ 
            color: 'rgba(255,255,255,0.6)',
            fontSize: '14px'
          }}>
            Redirecting to queue...
          </p>
        </div>
      </div>
    );
  }

  const isFreeEvent = !event.require_payment;
  const isFreeRequest = isFreeEvent || hostCodeValid;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0b0b0d 0%, #1a0a1f 100%)',
      color: '#eef',
      padding: '20px',
      fontFamily: '-apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', paddingTop: '40px' }}>
        
        <div style={{
          textAlign: 'center',
          marginBottom: '30px'
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #ff006e, #00f5ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '10px'
          }}>
            Request a Song
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: '16px'
          }}>
            {event.event_name}
          </p>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '30px',
          backdropFilter: 'blur(10px)'
        }}>
          <form onSubmit={handleSubmit}>
            
            <input
              type="text"
              placeholder="Your Name"
              value={formData.requester_name}
              onChange={(e) => setFormData({...formData, requester_name: e.target.value})}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '16px',
                marginBottom: '15px'
              }}
            />

            <input
              type="text"
              placeholder="Song Title"
              value={formData.song}
              onChange={(e) => setFormData({...formData, song: e.target.value})}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '16px',
                marginBottom: '15px'
              }}
            />

            <input
              type="text"
              placeholder="Artist"
              value={formData.artist}
              onChange={(e) => setFormData({...formData, artist: e.target.value})}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '16px',
                marginBottom: '15px'
              }}
            />

            <textarea
              placeholder="Message or dedication (optional)"
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              rows="3"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '16px',
                marginBottom: '15px',
                resize: 'vertical',
                fontFamily: '-apple-system, sans-serif'
              }}
            />

            {/* Host Code Section */}
            {event.host_code && (
              <div style={{
                padding: '15px',
                background: 'rgba(255,215,0,0.05)',
                border: `1px solid ${hostCodeValid ? '#00ff88' : 'rgba(255,215,0,0.2)'}`,
                borderRadius: '10px',
                marginBottom: '15px'
              }}>
                <label style={{
                  display: 'block',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '14px',
                  marginBottom: '8px'
                }}>
                  Host Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Enter host code for free request"
                  value={formData.host_code}
                  onChange={(e) => setFormData({...formData, host_code: e.target.value.toUpperCase()})}
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
                {hostCodeValid && (
                  <p style={{
                    color: '#00ff88',
                    fontSize: '13px',
                    marginTop: '8px',
                    marginBottom: '0'
                  }}>
                    Valid code! This request is free. ({event.host_code_uses_remaining - 1} uses remaining after this)
                  </p>
                )}
                {hostCodeError && (
                  <p style={{
                    color: '#ff6b6b',
                    fontSize: '13px',
                    marginTop: '8px',
                    marginBottom: '0'
                  }}>
                    {hostCodeError}
                  </p>
                )}
              </div>
            )}

            {/* Pricing Tiers - Only show if payment required and no valid host code */}
            {event.require_payment && !hostCodeValid && (
              <div style={{
                padding: '15px',
                background: 'rgba(255,0,110,0.05)',
                border: '1px solid rgba(255,0,110,0.2)',
                borderRadius: '10px',
                marginBottom: '20px'
              }}>
                <label style={{
                  display: 'block',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '14px',
                  marginBottom: '12px'
                }}>
                  Select Tier
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['tier_1', 'tier_2', 'tier_3'].map(tier => (
                    <label
                      key={tier}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px',
                        background: formData.tier === tier ? 'rgba(255,0,110,0.2)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${formData.tier === tier ? '#ff006e' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <input
                        type="radio"
                        name="tier"
                        value={tier}
                        checked={formData.tier === tier}
                        onChange={(e) => setFormData({...formData, tier: e.target.value})}
                        style={{ marginRight: '10px' }}
                      />
                      <span style={{
                        flex: 1,
                        color: 'white',
                        fontWeight: '600'
                      }}>
                        {event[`${tier}_name`]}
                      </span>
                      <span style={{
                        color: '#00f5ff',
                        fontWeight: '700'
                      }}>
                        ${event[`${tier}_price`]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Free Event Message */}
            {isFreeEvent && !event.host_code && (
              <div style={{
                padding: '15px',
                background: 'rgba(0,255,136,0.1)',
                border: '1px solid rgba(0,255,136,0.3)',
                borderRadius: '10px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <p style={{
                  color: '#00ff88',
                  fontSize: '14px',
                  margin: '0'
                }}>
                  This event has free requests!
                </p>
              </div>
            )}

            {error && (
              <p style={{ 
                color: '#ff6b6b',
                marginBottom: '15px',
                fontSize: '14px'
              }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '16px',
                background: isFreeRequest 
                  ? 'linear-gradient(135deg, #00ff88, #00cc6a)'
                  : 'linear-gradient(135deg, #ff006e, #ff4d8f)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '18px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: isFreeRequest
                  ? '0 4px 20px rgba(0,255,136,0.4)'
                  : '0 4px 20px rgba(255,0,110,0.4)'
              }}
            >
              {isFreeRequest ? 'Submit Free Request' : `Submit Request - $${event[`${formData.tier}_price`]}`}
            </button>
          </form>

          <button
            onClick={() => router.push(`/event/${code}`)}
            style={{
              width: '100%',
              marginTop: '15px',
              padding: '12px',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Back to Queue
          </button>
        </div>
      </div>
    </div>
  );
}
