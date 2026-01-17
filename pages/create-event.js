import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';

export default function CreateEvent() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    eventName: '',
    eventDate: '',
    venue: '',
    djPassword: '',
    standardPrice: '3.00',
    skip3Price: '5.00',
    playNextPrice: '10.00'
  });

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
  };

  const generateEventCode = (eventName) => {
    return eventName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString().slice(-6);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const eventCode = generateEventCode(formData.eventName);

      const { data, error: insertError } = await supabase
        .from('events')
        .insert([
          {
            dj_id: user.id,
            event_name: formData.eventName,
            event_date: formData.eventDate,
            venue: formData.venue,
            event_code: eventCode,
            dj_password: formData.djPassword,
            standard_price: parseFloat(formData.standardPrice),
            skip_3_price: parseFloat(formData.skip3Price),
            play_next_price: parseFloat(formData.playNextPrice),
            status: 'active'
          }
        ])
        .select();

      if (insertError) throw insertError;

      // Success - redirect to dashboard
      router.push('/dashboard');

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

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0b0d',
      color: '#eef',
      padding: '20px',
      fontFamily: '-apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        <div style={{ marginBottom: '30px' }}>
          <button
            onClick={() => router.push('/dashboard')}
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
            ← Back to Dashboard
          </button>
          
          <h1 style={{ 
            color: '#ff6b35',
            margin: '0 0 10px 0',
            fontSize: '32px'
          }}>
            Create New Event
          </h1>
          <p style={{ 
            color: 'rgba(255,255,255,0.6)',
            margin: '0',
            fontSize: '14px'
          }}>
            Set up your event and get your unique QR code
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          
          {/* Event Details */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '25px',
            marginBottom: '20px'
          }}>
            <h3 style={{ 
              color: '#fff',
              marginBottom: '20px',
              fontSize: '18px'
            }}>
              Event Details
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: 'rgba(255,255,255,0.8)',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Event Name *
              </label>
              <input
                type="text"
                name="eventName"
                value={formData.eventName}
                onChange={handleChange}
                placeholder="Birthday Bash 2025"
                required
                style={{
                  width: '100%',
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
                Event Date *
              </label>
              <input
                type="date"
                name="eventDate"
                value={formData.eventDate}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
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
                Venue *
              </label>
              <input
                type="text"
                name="venue"
                value={formData.venue}
                onChange={handleChange}
                placeholder="The Club"
                required
                style={{
                  width: '100%',
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
                DJ Panel Password *
              </label>
              <input
                type="password"
                name="djPassword"
                value={formData.djPassword}
                onChange={handleChange}
                placeholder="Password to access DJ control panel"
                required
                minLength={6}
                style={{
                  width: '100%',
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
                You'll need this to access the DJ control panel during the event
              </p>
            </div>
          </div>

          {/* Pricing */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '25px',
            marginBottom: '20px'
          }}>
            <h3 style={{ 
              color: '#fff',
              marginBottom: '10px',
              fontSize: '18px'
            }}>
              Song Request Pricing
            </h3>
            <p style={{
              fontSize: '13px',
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '20px'
            }}>
              Set your pricing tiers (payment held until you approve)
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: 'rgba(255,255,255,0.8)',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Standard Request ($)
              </label>
              <input
                type="number"
                name="standardPrice"
                value={formData.standardPrice}
                onChange={handleChange}
                step="0.50"
                min="0"
                required
                style={{
                  width: '100%',
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
                Skip 3 Songs ($)
              </label>
              <input
                type="number"
                name="skip3Price"
                value={formData.skip3Price}
                onChange={handleChange}
                step="0.50"
                min="0"
                required
                style={{
                  width: '100%',
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
                Play Next ($)
              </label>
              <input
                type="number"
                name="playNextPrice"
                value={formData.playNextPrice}
                onChange={handleChange}
                step="0.50"
                min="0"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '16px'
                }}
              />
            </div>
          </div>

          {/* Error Message */}
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading 
                ? 'rgba(255,255,255,0.1)' 
                : 'linear-gradient(135deg, #00f5ff, #00b8d4)',
              color: loading ? 'rgba(255,255,255,0.5)' : '#0a0a0a',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Creating Event...' : 'Create Event'}
          </button>
        </form>
      </div>
    </div>
  );
}
