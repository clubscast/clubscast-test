import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/router';

export default function DJPanel() {
  const router = useRouter();
  const { code } = router.query;
  
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [event, setEvent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEndEventModal, setShowEndEventModal] = useState(false);
  const [endEventMessage, setEndEventMessage] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    event_name: '',
    event_date: '',
    venue: '',
    tier_1_name: '',
    tier_1_price: '',
    tier_2_name: '',
    tier_2_price: '',
    tier_3_name: '',
    tier_3_price: '',
    host_code: '',
    host_code_uses_total: '',
    host_code_color: '#FFD700',
    require_payment: true
  });

  useEffect(() => {
    if (code) {
      loadEvent();
      checkRememberedPassword();
    }
  }, [code]);

  useEffect(() => {
    if (authenticated && event) {
      loadRequests();
      const interval = setInterval(loadRequests, 5000);
      return () => clearInterval(interval);
    }
  }, [authenticated, event]);

  const checkRememberedPassword = async () => {
    const stored = localStorage.getItem(`dj_auth_${code}`);
    if (stored) {
      try {
        const { password: savedPassword, expiry } = JSON.parse(stored);
        if (Date.now() < expiry) {
          setPassword(savedPassword);
          setTimeout(() => {
            setAuthenticated(true);
          }, 500);
        } else {
          localStorage.removeItem(`dj_auth_${code}`);
        }
      } catch (err) {
        localStorage.removeItem(`dj_auth_${code}`);
      }
    }
  };

  const loadEvent = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('event_code', code)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);
      
      setEditForm({
        event_name: eventData.event_name || '',
        event_date: eventData.event_date || '',
        venue: eventData.venue || '',
        tier_1_name: eventData.tier_1_name || '',
        tier_1_price: eventData.tier_1_price || '',
        tier_2_name: eventData.tier_2_name || '',
        tier_2_price: eventData.tier_2_price || '',
        tier_3_name: eventData.tier_3_name || '',
        tier_3_price: eventData.tier_3_price || '',
        host_code: eventData.host_code || '',
        host_code_uses_total: eventData.host_code_uses_total || '',
        host_code_color: eventData.host_code_color || '#FFD700',
        require_payment: eventData.require_payment
      });
      
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
      .order('queue_position', { ascending: true, nullsFirst: false });

    setRequests(data || []);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === event.dj_password) {
      setAuthenticated(true);
      setError('');
      
      if (rememberMe) {
        const expiry = Date.now() + (24 * 60 * 60 * 1000);
        localStorage.setItem(`dj_auth_${code}`, JSON.stringify({
          password: password,
          expiry: expiry
        }));
      }
    } else {
      setError('Incorrect password');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(`dj_auth_${code}`);
    setAuthenticated(false);
    setPassword('');
  };

  const handleApprove = async (requestId, paymentStatus) => {
    try {
      if (paymentStatus === 'authorized') {
        const response = await fetch('/api/capture-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId }),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to capture payment');
        }
      } else {
        const { error } = await supabase
          .from('requests')
          .update({ 
            request_status: 'approved',
            payment_status: paymentStatus === 'free' ? 'free' : 'captured'
          })
          .eq('id', requestId);

        if (error) throw error;
      }

      loadRequests();
    } catch (err) {
      alert('Error approving request: ' + err.message);
    }
  };

  const handleReject = async (requestId, paymentStatus) => {
    try {
      if (paymentStatus === 'authorized') {
        const response = await fetch('/api/cancel-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId }),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to cancel payment');
        }
      } else {
        const { error } = await supabase
          .from('requests')
          .update({ 
            request_status: 'rejected',
            payment_status: paymentStatus === 'free' ? 'free' : 'cancelled',
            rejection_reason: 'Song not available'
          })
          .eq('id', requestId);

        if (error) throw error;
      }

      loadRequests();
    } catch (err) {
      alert('Error rejecting request: ' + err.message);
    }
  };

  const handlePauseToggle = async () => {
    const newStatus = event.accepting_requests === 'open' ? 'paused' : 'open';
    
    const { error } = await supabase
      .from('events')
      .update({ 
        accepting_requests: newStatus,
        pause_message: 'Thank you for all the requests. I am catching up and will open it again soon.'
      })
      .eq('id', event.id);

    if (!error) {
      setEvent({...event, accepting_requests: newStatus});
    }
  };

  const handleEndEvent = async () => {
    if (!endEventMessage.trim()) {
      alert('Please enter a closing message');
      return;
    }

    const { error } = await supabase
      .from('events')
      .update({ 
        accepting_requests: 'ended',
        end_message: endEventMessage
      })
      .eq('id', event.id);

    if (!error) {
      setEvent({...event, accepting_requests: 'ended', end_message: endEventMessage});
      setShowEndEventModal(false);
      setEndEventMessage('');
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    
    const { error } = await supabase
      .from('events')
      .update({
        event_name: editForm.event_name,
        event_date: editForm.event_date,
        venue: editForm.venue,
        tier_1_name: editForm.tier_1_name,
        tier_1_price: parseFloat(editForm.tier_1_price),
        tier_2_name: editForm.tier_2_name,
        tier_2_price: parseFloat(editForm.tier_2_price),
        tier_3_name: editForm.tier_3_name,
        tier_3_price: parseFloat(editForm.tier_3_price),
        host_code: editForm.host_code || null,
        host_code_uses_total: parseInt(editForm.host_code_uses_total) || 0,
        host_code_uses_remaining: parseInt(editForm.host_code_uses_total) || 0,
        host_code_color: editForm.host_code_color,
        require_payment: editForm.require_payment
      })
      .eq('id', event.id);

    if (!error) {
      loadEvent();
      setShowEditModal(false);
    }
  };

  const handleReopenEvent = async () => {
    const { error } = await supabase
      .from('events')
      .update({ 
        accepting_requests: 'open',
        end_message: null
      })
      .eq('id', event.id);

    if (!error) {
      setEvent({...event, accepting_requests: 'open', end_message: null});
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
            DJ Control Panel
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
            
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              Remember me for 24 hours
            </label>

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

  const acceptingStatus = event.accepting_requests || 'open';

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
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div>
            <h1 style={{ 
              color: '#ff6b35',
              margin: '0 0 5px 0',
              fontSize: '28px'
            }}>
              DJ Control Panel
            </h1>
            <p style={{ 
              color: '#aaa',
              margin: '0',
              fontSize: '14px'
            }}>
              {event.event_name} • {event.venue}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {event.host_code && (
              <div style={{
                padding: '8px 15px',
                background: 'rgba(255,215,0,0.1)',
                border: '1px solid rgba(255,215,0,0.3)',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#FFD700'
              }}>
                Host Code: {event.host_code_uses_remaining}/{event.host_code_uses_total} uses left
              </div>
            )}
            <button
              onClick={() => router.push(`/event/${code}`)}
              style={{
                padding: '10px 20px',
                background: 'rgba(0,245,255,0.2)',
                color: '#00f5ff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              View Queue
            </button>
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
        </div>

        {/* Control Buttons */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setShowEditModal(true)}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #00f5ff, #0099ff)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0,245,255,0.3)'
            }}
          >
            Edit Event
          </button>

          {acceptingStatus !== 'ended' && (
            <button
              onClick={handlePauseToggle}
              style={{
                padding: '12px 24px',
                background: acceptingStatus === 'paused' 
                  ? 'linear-gradient(135deg, #00ff88, #00cc6a)'
                  : 'linear-gradient(135deg, #FFD700, #FFA500)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(255,215,0,0.3)'
              }}
            >
              {acceptingStatus === 'paused' ? 'Resume Requests' : 'Pause Requests'}
            </button>
          )}
          
          {acceptingStatus !== 'ended' && (
            <button
              onClick={() => setShowEndEventModal(true)}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #ff006e, #ff4d8f)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(255,0,110,0.3)'
              }}
            >
              🏁 End Event
            </button>
          )}

          {acceptingStatus === 'ended' && (
            <button
              onClick={handleReopenEvent}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #00ff88, #00cc6a)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0,255,136,0.3)'
              }}
            >
              Reopen Event
            </button>
          )}

          {/* Status Indicator */}
          <div style={{
            padding: '12px 24px',
            background: acceptingStatus === 'ended' 
              ? 'rgba(255,0,0,0.2)'
              : acceptingStatus === 'paused'
                ? 'rgba(255,215,0,0.2)'
                : 'rgba(0,255,136,0.2)',
            border: `1px solid ${
              acceptingStatus === 'ended'
                ? 'rgba(255,0,0,0.4)'
                : acceptingStatus === 'paused'
                  ? 'rgba(255,215,0,0.4)'
                  : 'rgba(0,255,136,0.4)'
            }`,
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '600',
            color: acceptingStatus === 'ended'
              ? '#ff6b6b'
              : acceptingStatus === 'paused'
                ? '#FFD700'
                : '#00ff88'
          }}>
            {acceptingStatus === 'ended' 
              ? 'Event Ended'
              : acceptingStatus === 'paused'
                ? 'Paused'
                : 'Accepting Requests'}
          </div>
        </div>

        {/* End Event Modal */}
        {showEndEventModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: '#0b0b0d',
              border: '2px solid rgba(255,0,110,0.3)',
              borderRadius: '20px',
              padding: '40px',
              maxWidth: '500px',
              width: '100%'
            }}>
              <h2 style={{
                color: '#ff006e',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                End Event
              </h2>
              <p style={{
                color: 'rgba(255,255,255,0.7)',
                textAlign: 'center',
                marginBottom: '20px',
                fontSize: '14px'
              }}>
                Write a custom closing message for your guests:
              </p>
              <textarea
                value={endEventMessage}
                onChange={(e) => setEndEventMessage(e.target.value)}
                placeholder="Thanks for rocking with DJ JINKZ tonight! See you next time! 🎵"
                rows="4"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '14px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '14px',
                  marginBottom: '20px',
                  resize: 'vertical',
                  fontFamily: '-apple-system, sans-serif'
                }}
              />
              <div style={{
                display: 'flex',
                gap: '10px'
              }}>
                <button
                  onClick={handleEndEvent}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: '#ff006e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  End Event
                </button>
                <button
                  onClick={() => {
                    setShowEndEventModal(false);
                    setEndEventMessage('');
                  }}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Event Modal */}
        {showEditModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            overflow: 'auto'
          }}>
            <div style={{
              background: '#0b0b0d',
              border: '2px solid rgba(0,245,255,0.3)',
              borderRadius: '20px',
              padding: '40px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <h2 style={{
                color: '#00f5ff',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                Edit Event Settings
              </h2>
              
              <form onSubmit={handleSaveEdit}>
                <input
                  type="text"
                  placeholder="Event Name"
                  value={editForm.event_name}
                  onChange={(e) => setEditForm({...editForm, event_name: e.target.value})}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    marginBottom: '15px'
                  }}
                />

                <input
                  type="datetime-local"
                  value={editForm.event_date}
                  onChange={(e) => setEditForm({...editForm, event_date: e.target.value})}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    marginBottom: '15px'
                  }}
                />

                <input
                  type="text"
                  placeholder="Venue"
                  value={editForm.venue}
                  onChange={(e) => setEditForm({...editForm, venue: e.target.value})}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    marginBottom: '20px'
                  }}
                />

                <div style={{
                  padding: '15px',
                  background: 'rgba(255,0,110,0.05)',
                  border: '1px solid rgba(255,0,110,0.2)',
                  borderRadius: '10px',
                  marginBottom: '20px'
                }}>
                  <h3 style={{ fontSize: '14px', color: '#ff006e', marginBottom: '15px' }}>Pricing Tiers</h3>
                  
                  {['tier_1', 'tier_2', 'tier_3'].map(tier => (
                    <div key={tier} style={{ marginBottom: '15px' }}>
                      <input
                        type="text"
                        placeholder={`${tier} Name`}
                        value={editForm[`${tier}_name`]}
                        onChange={(e) => setEditForm({...editForm, [`${tier}_name`]: e.target.value})}
                        required
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          color: 'white',
                          fontSize: '13px',
                          marginBottom: '8px'
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={editForm[`${tier}_price`]}
                        onChange={(e) => setEditForm({...editForm, [`${tier}_price`]: e.target.value})}
                        required
                        min="0"
                        step="0.01"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '10px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          color: 'white',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{
                  padding: '15px',
                  background: 'rgba(255,215,0,0.05)',
                  border: '1px solid rgba(255,215,0,0.2)',
                  borderRadius: '10px',
                  marginBottom: '20px'
                }}>
                  <h3 style={{ fontSize: '14px', color: '#FFD700', marginBottom: '15px' }}>Host Code (Optional)</h3>
                  
                  <input
                    type="text"
                    placeholder="Host Code"
                    value={editForm.host_code}
                    onChange={(e) => setEditForm({...editForm, host_code: e.target.value.toUpperCase()})}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '13px',
                      marginBottom: '10px'
                    }}
                  />

                  <input
                    type="number"
                    placeholder="Total Uses"
                    value={editForm.host_code_uses_total}
                    onChange={(e) => setEditForm({...editForm, host_code_uses_total: e.target.value})}
                    min="0"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '13px',
                      marginBottom: '10px'
                    }}
                  />

                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>
                      Color
                    </label>
                    <input
                      type="color"
                      value={editForm.host_code_color}
                      onChange={(e) => setEditForm({...editForm, host_code_color: e.target.value})}
                      style={{
                        width: '60px',
                        height: '40px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                </div>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '25px',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.9)'
                }}>
                  <input
                    type="checkbox"
                    checked={editForm.require_payment}
                    onChange={(e) => setEditForm({...editForm, require_payment: e.target.checked})}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  Require payment for requests
                </label>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'linear-gradient(135deg, #00f5ff, #0099ff)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '20px'
        }}>
          
          {/* Pending Requests */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,0,110,0.2)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h2 style={{ 
              fontSize: '18px',
              marginBottom: '15px',
              color: '#ff006e'
            }}>
              Song Requests ({pending.length})
            </h2>
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '600px',
              overflowY: 'auto'
            }}>
              {pending.map(request => (
                <div
                  key={request.id}
                  style={{
                    background: request.used_host_code
                      ? `${event.host_code_color}15`
                      : 'rgba(255,255,255,0.05)',
                    padding: '12px',
                    borderRadius: '8px',
                    border: request.used_host_code
                      ? `1px solid ${event.host_code_color}`
                      : '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#00f5ff',
                    minWidth: '30px'
                  }}>
                    #{request.queue_position || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontWeight: '600',
                      marginBottom: '3px',
                      color: '#fff',
                      fontSize: '15px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {request.song}
                    </div>
                    <div style={{ 
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.7)',
                      marginBottom: '3px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {request.artist}
                    </div>
                    <div style={{ 
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.6)'
                    }}>
                      {request.requester_name} • ${request.amount} • {request.tier_name}
                      {request.used_host_code && (
                        <span style={{
                          marginLeft: '8px',
                          padding: '2px 6px',
                          background: `${event.host_code_color}30`,
                          borderRadius: '3px',
                          fontSize: '10px',
                          fontWeight: '600',
                          color: event.host_code_color
                        }}>
                          HOST
                        </span>
                      )}
                    </div>
                    {request.message && (
                      <div style={{
                        fontSize: '12px',
                        fontStyle: 'italic',
                        color: 'rgba(255,255,255,0.5)',
                        marginTop: '5px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        "{request.message}"
                      </div>
                    )}
                  </div>
                  <div style={{ 
                    display: 'flex',
                    gap: '6px',
                    flexShrink: 0
                  }}>
                    <button
                      onClick={() => handleApprove(request.id, request.payment_status)}
                      style={{
                        padding: '6px 12px',
                        background: '#00ff88',
                        color: '#0a0a0a',
                        border: 'none',
                        borderRadius: '5px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Played
                    </button>
                    <button
                      onClick={() => handleReject(request.id, request.payment_status)}
                      style={{
                        padding: '6px 12px',
                        background: 'rgba(255,0,0,0.2)',
                        color: '#ff6b6b',
                        border: '1px solid rgba(255,0,0,0.3)',
                        borderRadius: '5px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}
              {pending.length === 0 && (
                <p style={{ 
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.4)',
                  padding: '20px'
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
              History
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
                  Played ({approved.length})
                </summary>
                <div style={{ paddingLeft: '10px' }}>
                  {approved.map(request => (
                    <div
                      key={request.id}
                      style={{
                        padding: '8px',
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.6)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                      }}
                    >
                      {request.song} - {request.artist}
                    </div>
                  ))}
                </div>
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
                  Skipped ({rejected.length})
                </summary>
                <div style={{ paddingLeft: '10px' }}>
                  {rejected.map(request => (
                    <div
                      key={request.id}
                      style={{
                        padding: '8px',
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.6)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                      }}
                    >
                      {request.song} - {request.artist}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
