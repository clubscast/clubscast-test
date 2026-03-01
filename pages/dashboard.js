import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import QRCode from 'qrcode';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [newEvent, setNewEvent] = useState({
    event_name: '',
    event_date: '',
    venue: '',
    event_code: '',
    dj_password: '',
    require_payment: true,
    host_code: '',
    host_code_uses: '',
    host_code_color: '#FFD700',
    tier_1_name: 'Standard',
    tier_1_price: '5',
    tier_2_name: 'Priority',
    tier_2_price: '10',
    tier_3_name: 'VIP',
    tier_3_price: '20'
  });

  useEffect(() => {
  checkUser();
}, []); // ← existing one, leave as is

// ADD THIS NEW ONE RIGHT BELOW:
useEffect(() => {
  if (router.query.from === 'stripe') {
    checkUser();
  }
}, [router.query]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: djData } = await supabase
      .from('djs')
      .select('*')
      .eq('id', session.user.id)
      .single();

    setUser(djData);
    loadEvents(session.user.id);
  };

  const loadEvents = async (djId = user?.id) => {
    if (!djId) return;

    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('dj_id', djId)
      .order('event_date', { ascending: true });

    setEvents(data || []);
    setLoading(false);
  };

  const handleExportCSV = async (event) => {
    try {
      // Fetch all requests for this event
      const { data: requests, error } = await supabase
        .from('requests')
        .select('*')
        .eq('event_id', event.id)
       .order('queue_position', { ascending: true, nullsFirst: false });

      if (error) throw error;

      if (!requests || requests.length === 0) {
        alert('No requests to export for this event');
        return;
      }

      // Create CSV
      const headers = [
        'Position',
        'Status',
        'Song',
        'Artist',
        'Requester',
        'Tier',
        'DJ Price',
        'Service Fee',
        'Total Amount',
        'Payment Status',
        'Message',
        'Host Code Used'
      ];

      const csvRows = [
        headers.join(','),
        ...requests.map((req, index) => {
          const row = [
            req.queue_position || (index + 1),
            req.request_status,
            `"${req.song}"`,
            `"${req.artist}"`,
            `"${req.requester_name}"`,
            req.tier_name,
            req.dj_price || 0,
            req.service_fee || 0,
            req.amount || 0,
            req.payment_status,
            `"${req.message || ''}"`,
            req.used_host_code ? 'Yes' : 'No'
          ];
          return row.join(',');
        })
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${event.event_name.replace(/\s+/g, '_')}_${event.event_code}_requests.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error exporting CSV: ' + err.message);
    }
  };

  const createEvent = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const { data, error } = await supabase
        .from('events')
        .insert([
          {
            dj_id: user.id,
            event_name: newEvent.event_name,
            event_date: newEvent.event_date,
            venue: newEvent.venue,
            event_code: newEvent.event_code,
            dj_password: newEvent.dj_password,
            require_payment: newEvent.require_payment,
            host_code: newEvent.host_code || null,
            host_code_uses_total: parseInt(newEvent.host_code_uses) || 0,
            host_code_uses_remaining: parseInt(newEvent.host_code_uses) || 0,
            host_code_color: newEvent.host_code_color || '#FFD700',
            tier_1_name: newEvent.tier_1_name,
            tier_1_price: parseFloat(newEvent.tier_1_price),
            tier_2_name: newEvent.tier_2_name,
            tier_2_price: parseFloat(newEvent.tier_2_price),
            tier_3_name: newEvent.tier_3_name,
            tier_3_price: parseFloat(newEvent.tier_3_price)
          }
        ])
        .select();

      if (error) throw error;

      setShowCreateForm(false);
      setNewEvent({
        event_name: '',
        event_date: '',
        venue: '',
        event_code: '',
        dj_password: '',
        require_payment: true,
        host_code: '',
        host_code_uses: '',
        host_code_color: '#FFD700',
        tier_1_name: 'Standard',
        tier_1_price: '5',
        tier_2_name: 'Priority',
        tier_2_price: '10',
        tier_3_name: 'VIP',
        tier_3_price: '20'
      });
      loadEvents();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteEvent = async (eventId) => {
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      // Recalculate DJ overall rating after deleting event
      const { data: remainingEvents } = await supabase
        .from('events')
        .select('average_rating')
        .eq('dj_id', user.id)
        .gt('total_ratings', 0);

      if (remainingEvents && remainingEvents.length > 0) {
        const djOverallRating = remainingEvents.reduce((sum, e) => sum + parseFloat(e.average_rating), 0) / remainingEvents.length;
        
        await supabase
          .from('djs')
          .update({ overall_rating: djOverallRating.toFixed(2) })
          .eq('id', user.id);
      } else {
        await supabase
          .from('djs')
          .update({ overall_rating: 0 })
          .eq('id', user.id);
      }

      setDeleteConfirm(null);
      loadEvents();
    } catch (err) {
      setError(err.message);
    }
  };

  const generateQR = async (eventCode) => {
    try {
      const url = `${window.location.origin}/event/${eventCode}`;
      const qrDataURL = await QRCode.toDataURL(url, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      const qrWindow = window.open('', '_blank', 'width=500,height=600');
      qrWindow.document.write(`
        <html>
          <head>
            <title>QR Code - ${eventCode}</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                background: #0b0b0d;
                color: white;
                font-family: -apple-system, sans-serif;
              }
              h1 { margin-bottom: 10px; color: #ff6b35; }
              p { margin-bottom: 20px; color: rgba(255,255,255,0.7); }
              img { border: 10px solid white; border-radius: 10px; }
              button {
                margin-top: 20px;
                padding: 12px 24px;
                background: linear-gradient(135deg, #ff006e, #ff4d8f);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <h1>Event QR Code</h1>
            <p>Code: ${eventCode}</p>
            <img src="${qrDataURL}" alt="QR Code" />
            <button onclick="window.print()">Print QR Code</button>
          </body>
        </html>
      `);
    } catch (err) {
      alert('Error generating QR code: ' + err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
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
      background: '#0a0a0f',
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
          gap: '15px'
        }}>
          <div>
            <h1 style={{ 
              color: '#ff006e',
              margin: '0 0 5px 0'
            }}>
              DJ Dashboard
            </h1>
            <p style={{ 
              color: '#aaa',
              margin: '0',
              fontSize: '14px'
            }}>
              Welcome back, {user?.dj_name}
              {user?.overall_rating > 0 && (
                <span style={{
                  marginLeft: '10px',
                  color: '#FFD700'
                }}>
                  {'★'.repeat(Math.round(parseFloat(user.overall_rating)))}{'☆'.repeat(5 - Math.round(parseFloat(user.overall_rating)))}
                  <span style={{ color: '#aaa', fontSize: '12px', marginLeft: '5px' }}>
                    ({user.overall_rating}/5)
                  </span>
                </span>
              )}
            </p>
            {!user?.stripe_account_id && (
              <div style={{
                marginTop: '10px',
                padding: '8px 12px',
                background: 'rgba(255,215,0,0.1)',
                border: '1px solid rgba(255,215,0,0.3)',
                borderRadius: '6px',
                display: 'inline-block'
              }}>
                <span style={{
                  color: '#FFD700',
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  ⚠ Stripe Not Connected
                </span>
              </div>
            )}
            {user?.stripe_account_id && (
              <div style={{
                marginTop: '10px',
                padding: '8px 12px',
                background: 'rgba(0,255,136,0.1)',
                border: '1px solid rgba(0,255,136,0.3)',
                borderRadius: '6px',
                display: 'inline-block'
              }}>
                <span style={{
                  color: '#00ff88',
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  ✓ Stripe Connected
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {!user?.stripe_account_id && (
              <button
                onClick={() => {
                  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
                  const returnUrl = `${baseUrl}/api/stripe-oauth-callback`;
                  const stripeConnectUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_STRIPE_CONNECT_CLIENT_ID}&scope=read_write&state=${user.id}&redirect_uri=${encodeURIComponent(returnUrl)}`;
                  window.open(stripeConnectUrl, '_blank');
                  alert('Stripe Connect opened in a new tab. Complete the setup, then refresh this page.');
                }}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #00f5ff, #0099ff)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  boxShadow: '0 4px 15px rgba(0,245,255,0.3)'
                }}
              >
                Connect Stripe
              </button>
            )}
            <button
              onClick={handleLogout}
              style={{
                padding: '10px 20px',
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
        </div>

        {/* Create Event Button */}
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: '14px 30px',
              background: 'linear-gradient(135deg, #ff006e, #ff4d8f)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer',
              marginBottom: '30px',
              boxShadow: '0 4px 20px rgba(255,0,110,0.3)'
            }}
          >
            Create New Event
          </button>
        )}

        {/* Create Event Form */}
        {showCreateForm && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '15px',
            padding: '30px',
            marginBottom: '30px'
          }}>
            <h2 style={{ 
              color: '#ff006e',
              marginBottom: '20px'
            }}>
              Create New Event
            </h2>

            <form onSubmit={createEvent}>
              {/* Basic Info */}
              <input
                type="text"
                placeholder="Event Name"
                value={newEvent.event_name}
                onChange={(e) => setNewEvent({...newEvent, event_name: e.target.value})}
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
                value={newEvent.event_date}
                onChange={(e) => setNewEvent({...newEvent, event_date: e.target.value})}
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
                value={newEvent.venue}
                onChange={(e) => setNewEvent({...newEvent, venue: e.target.value})}
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
                placeholder="Event Code (for guests to access queue)"
                value={newEvent.event_code}
                onChange={(e) => setNewEvent({...newEvent, event_code: e.target.value.toUpperCase()})}
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
                type="password"
                placeholder="DJ Password (for control panel)"
                value={newEvent.dj_password}
                onChange={(e) => setNewEvent({...newEvent, dj_password: e.target.value})}
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

              {/* Payment Settings */}
              <div style={{
                padding: '20px',
                background: 'rgba(0,245,255,0.05)',
                border: '1px solid rgba(0,245,255,0.2)',
                borderRadius: '12px',
                marginBottom: '20px'
              }}>
                <h3 style={{
                  color: '#00f5ff',
                  fontSize: '16px',
                  marginBottom: '15px',
                  fontWeight: '600'
                }}>
                  Payment Settings
                </h3>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '20px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={newEvent.require_payment}
                    onChange={(e) => setNewEvent({...newEvent, require_payment: e.target.checked})}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ color: 'rgba(255,255,255,0.9)' }}>
                    Require payment for requests
                  </span>
                </label>

                <p style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.5)',
                  marginTop: '-10px'
                }}>
                  {newEvent.require_payment 
                    ? 'Guests must pay using pricing tiers below (unless using host code)'
                    : 'All requests are free for everyone'}
                </p>
              </div>

              {/* Host Code Settings */}
              <div style={{
                padding: '20px',
                background: 'rgba(255,215,0,0.05)',
                border: '1px solid rgba(255,215,0,0.2)',
                borderRadius: '12px',
                marginBottom: '20px'
              }}>
                <h3 style={{
                  color: '#FFD700',
                  fontSize: '16px',
                  marginBottom: '15px',
                  fontWeight: '600'
                }}>
                  Host Code (Optional)
                </h3>

                <input
                  type="text"
                  placeholder="Enter host code (e.g., PARTY2025)"
                  value={newEvent.host_code}
                  onChange={(e) => setNewEvent({...newEvent, host_code: e.target.value.toUpperCase()})}
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
                  type="number"
                  placeholder="Number of free uses"
                  value={newEvent.host_code_uses}
                  onChange={(e) => setNewEvent({...newEvent, host_code_uses: e.target.value})}
                  min="0"
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

                <div>
                  <label style={{
                    display: 'block',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '13px',
                    marginBottom: '8px'
                  }}>
                    Host Code Request Color
                  </label>
                  <input
                    type="color"
                    value={newEvent.host_code_color}
                    onChange={(e) => setNewEvent({...newEvent, host_code_color: e.target.value})}
                    style={{
                      width: '60px',
                      height: '40px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: 'transparent'
                    }}
                  />
                </div>

                <p style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.5)',
                  marginTop: '15px'
                }}>
                  Host code allows free requests even if payment is required. Requests using this code will appear in the selected color.
                </p>
              </div>

              {/* Pricing Tiers */}
              <div style={{
                padding: '20px',
                background: 'rgba(255,0,110,0.05)',
                border: '1px solid rgba(255,0,110,0.2)',
                borderRadius: '12px',
                marginBottom: '20px'
              }}>
                <h3 style={{
                  color: '#ff006e',
                  fontSize: '16px',
                  marginBottom: '15px',
                  fontWeight: '600'
                }}>
                  Pricing Tiers {!newEvent.require_payment && '(Not Used - Event is Free)'}
                </h3>

                <div style={{ marginBottom: '15px' }}>
                  <input
                    type="text"
                    placeholder="Tier 1 Name"
                    value={newEvent.tier_1_name}
                    onChange={(e) => setNewEvent({...newEvent, tier_1_name: e.target.value})}
                    required={newEvent.require_payment}
                    disabled={!newEvent.require_payment}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '14px',
                      marginBottom: '10px',
                      opacity: newEvent.require_payment ? 1 : 0.5
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={newEvent.tier_1_price}
                    onChange={(e) => setNewEvent({...newEvent, tier_1_price: e.target.value})}
                    required={newEvent.require_payment}
                    disabled={!newEvent.require_payment}
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '14px',
                      opacity: newEvent.require_payment ? 1 : 0.5
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <input
                    type="text"
                    placeholder="Tier 2 Name"
                    value={newEvent.tier_2_name}
                    onChange={(e) => setNewEvent({...newEvent, tier_2_name: e.target.value})}
                    required={newEvent.require_payment}
                    disabled={!newEvent.require_payment}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '14px',
                      marginBottom: '10px',
                      opacity: newEvent.require_payment ? 1 : 0.5
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={newEvent.tier_2_price}
                    onChange={(e) => setNewEvent({...newEvent, tier_2_price: e.target.value})}
                    required={newEvent.require_payment}
                    disabled={!newEvent.require_payment}
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '14px',
                      opacity: newEvent.require_payment ? 1 : 0.5
                    }}
                  />
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Tier 3 Name"
                    value={newEvent.tier_3_name}
                    onChange={(e) => setNewEvent({...newEvent, tier_3_name: e.target.value})}
                    required={newEvent.require_payment}
                    disabled={!newEvent.require_payment}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '14px',
                      marginBottom: '10px',
                      opacity: newEvent.require_payment ? 1 : 0.5
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={newEvent.tier_3_price}
                    onChange={(e) => setNewEvent({...newEvent, tier_3_price: e.target.value})}
                    required={newEvent.require_payment}
                    disabled={!newEvent.require_payment}
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '14px',
                      opacity: newEvent.require_payment ? 1 : 0.5
                    }}
                  />
                </div>
              </div>

              {error && (
                <p style={{ color: '#ff6b6b', marginBottom: '15px' }}>
                  {error}
                </p>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'linear-gradient(135deg, #ff006e, #ff4d8f)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Create Event
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
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
            </form>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
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
              border: '2px solid rgba(255,0,0,0.3)',
              borderRadius: '20px',
              padding: '40px',
              maxWidth: '500px',
              width: '100%'
            }}>
              <h2 style={{
                color: '#ff6b6b',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                Delete Event?
              </h2>
              <p style={{
                color: 'rgba(255,255,255,0.7)',
                textAlign: 'center',
                marginBottom: '30px'
              }}>
                Are you sure you want to delete "{deleteConfirm.event_name}"? This action cannot be undone.
              </p>
              <div style={{
                display: 'flex',
                gap: '10px'
              }}>
                <button
                  onClick={() => deleteEvent(deleteConfirm.id)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: '#ff6b6b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
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

        {/* Events List */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '20px'
        }}>
          {events.map(event => (
            <div
              key={event.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '15px',
                padding: '25px',
                transition: 'all 0.3s ease'
              }}
            >
              <h3 style={{ 
                color: '#ff006e',
                marginBottom: '10px',
                fontSize: '20px'
              }}>
                {event.event_name}
              </h3>
              
              {event.total_ratings > 0 && (
                <div style={{
                  color: '#FFD700',
                  fontSize: '16px',
                  marginBottom: '10px'
                }}>
                  {'★'.repeat(Math.round(parseFloat(event.average_rating)))}{'☆'.repeat(5 - Math.round(parseFloat(event.average_rating)))}
                  <span style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '12px',
                    marginLeft: '8px'
                  }}>
                    ({event.average_rating}/5)
                  </span>
                </div>
              )}
              
              <p style={{ 
                color: 'rgba(255,255,255,0.7)',
                fontSize: '14px',
                marginBottom: '5px'
              }}>
                {event.venue}
              </p>
              <p style={{ 
                color: 'rgba(255,255,255,0.6)',
                fontSize: '13px',
                marginBottom: '15px'
              }}>
                {new Date(event.event_date).toLocaleString()}
              </p>
              <p style={{ 
                color: '#00f5ff',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '15px'
              }}>
                Code: {event.event_code}
              </p>

              <button
                onClick={() => generateQR(event.event_code)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255,215,0,0.2)',
                  color: '#FFD700',
                  border: '1px solid rgba(255,215,0,0.3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '10px'
                }}
              >
                Show QR Code
              </button>

              <div style={{ 
                display: 'flex',
                gap: '10px',
                marginBottom: '10px'
              }}>
                <button
                  onClick={() => router.push(`/event/${event.event_code}`)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'rgba(0,245,255,0.2)',
                    color: '#00f5ff',
                    border: '1px solid rgba(0,245,255,0.5)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  View Queue
                </button>
                <button
                  onClick={() => router.push(`/event/${event.event_code}/dj`)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'rgba(255,0,110,0.2)',
                    color: '#ff006e',
                    border: '1px solid rgba(255,0,110,0.5)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  DJ Panel
                </button>
              </div>

              <button
                onClick={() => handleExportCSV(event)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(0,245,255,0.2)',
                  color: '#00f5ff',
                  border: '1px solid rgba(0,245,255,0.5)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '10px'
                }}
              >
                Export CSV
              </button>

              <button
                onClick={() => setDeleteConfirm(event)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255,0,0,0.2)',
                  color: '#ff6b6b',
                  border: '1px solid rgba(255,0,0,0.3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Delete Event
              </button>
            </div>
          ))}
        </div>

        {events.length === 0 && !showCreateForm && (
          <p style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.4)',
            marginTop: '40px'
          }}>
            No events yet. Create your first event to get started!
          </p>
        )}
      </div>
    </div>
  );
}
