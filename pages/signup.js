import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [djName, setDjName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showStripeButton, setShowStripeButton] = useState(false);
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      // Insert DJ profile
      const { error: profileError } = await supabase
        .from('djs')
        .insert([{ 
          id: authData.user.id, 
          email, 
          dj_name: djName 
        }]);

      if (profileError) throw profileError;

      // Build Stripe Connect URL (Standard accounts)
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://clubscast-request.vercel.app';
      const stripeClientId = process.env.NEXT_PUBLIC_STRIPE_CONNECT_CLIENT_ID;
      const redirectUri = `${baseUrl}/api/stripe-oauth-callback`;
      
      const stripeUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${stripeClientId}&state=${authData.user.id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read_write`;

      // Open Stripe in new tab
      window.open(stripeUrl, '_blank');
      setShowStripeButton(true);
      setMessage('Account created! Stripe Connect has opened in a new tab. Complete the setup, then click below to go to your dashboard.');

    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (showStripeButton) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          background: '#1a1a1f',
          border: '1px solid #ff006e',
          borderRadius: '12px',
          padding: '40px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center'
        }}>
          <h1 style={{
            color: '#ff006e',
            fontSize: '28px',
            marginBottom: '20px',
            textShadow: '0 0 10px rgba(255, 0, 110, 0.5)'
          }}>
            Account Created! ✓
          </h1>
          
          <p style={{
            color: '#e0e0e0',
            fontSize: '16px',
            lineHeight: '1.6',
            marginBottom: '30px'
          }}>
            {message}
          </p>

          <div style={{ marginBottom: '20px' }}>
            <p style={{
              color: '#00f5ff',
              fontSize: '14px',
              marginBottom: '15px'
            }}>
              After completing Stripe setup in the new tab:
            </p>
          </div>

          <button
            onClick={() => router.push('/')}
            style={{
              background: 'linear-gradient(135deg, #ff006e, #00f5ff)',
              color: '#0a0a0f',
              border: 'none',
              padding: '15px 40px',
              fontSize: '18px',
              fontWeight: 'bold',
              borderRadius: '8px',
              cursor: 'pointer',
              width: '100%',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 0 20px rgba(255, 0, 110, 0.3)'
            }}
            onMouseOver={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 0 30px rgba(0, 245, 255, 0.5)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = '0 0 20px rgba(255, 0, 110, 0.3)';
            }}
          >
            Go to Dashboard
          </button>

          <p style={{
            color: '#888',
            fontSize: '12px',
            marginTop: '20px'
          }}>
            You can close the Stripe tab once you've completed setup
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: '#1a1a1f',
        border: '1px solid #ff006e',
        borderRadius: '12px',
        padding: '40px',
        maxWidth: '450px',
        width: '100%',
        boxShadow: '0 0 30px rgba(255, 0, 110, 0.2)'
      }}>
        <h1 style={{
          color: '#ff006e',
          textAlign: 'center',
          marginBottom: '10px',
          fontSize: '32px',
          textShadow: '0 0 10px rgba(255, 0, 110, 0.5)'
        }}>
          ClubsCast DJ
        </h1>
        
        <p style={{
          color: '#00f5ff',
          textAlign: 'center',
          marginBottom: '30px',
          fontSize: '14px'
        }}>
          Create your DJ account
        </p>

        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: '#e0e0e0',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              DJ Name
            </label>
            <input
              type="text"
              value={djName}
              onChange={(e) => setDjName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0f',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.3s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#ff006e'}
              onBlur={(e) => e.target.style.borderColor = '#333'}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: '#e0e0e0',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0f',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.3s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#ff006e'}
              onBlur={(e) => e.target.style.borderColor = '#333'}
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={{
              display: 'block',
              color: '#e0e0e0',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                background: '#0a0a0f',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.3s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#ff006e'}
              onBlur={(e) => e.target.style.borderColor = '#333'}
            />
          </div>

          {message && !showStripeButton && (
            <div style={{
              padding: '12px',
              background: message.includes('created') ? 'rgba(0, 245, 255, 0.1)' : 'rgba(255, 0, 110, 0.1)',
              border: `1px solid ${message.includes('created') ? '#00f5ff' : '#ff006e'}`,
              borderRadius: '6px',
              color: message.includes('created') ? '#00f5ff' : '#ff006e',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#333' : 'linear-gradient(135deg, #ff006e, #00f5ff)',
              color: loading ? '#666' : '#0a0a0f',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: loading ? 'none' : '0 0 20px rgba(255, 0, 110, 0.3)'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.target.style.transform = 'scale(1.02)';
                e.target.style.boxShadow = '0 0 30px rgba(0, 245, 255, 0.5)';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 0 20px rgba(255, 0, 110, 0.3)';
              }
            }}
          >
            {loading ? 'Creating Account...' : 'Create Account & Connect Stripe'}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: '20px',
          color: '#888',
          fontSize: '13px'
        }}>
          Already have an account?{' '}
          <a href="/" style={{
            color: '#00f5ff',
            textDecoration: 'none',
            transition: 'color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.color = '#ff006e'}
          onMouseOut={(e) => e.target.style.color = '#00f5ff'}
          >
            Sign In
          </a>
        </p>
      </div>
    </div>
  );
}
