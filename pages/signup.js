import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';

export default function Signup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    dj_name: ''
  });

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      // Insert DJ record
      const { error: djError } = await supabase
        .from('djs')
        .insert([
          {
            id: authData.user.id,
            email: formData.email,
            dj_name: formData.dj_name,
            stripe_account_id: null
          }
        ]);

      if (djError) throw djError;

      // Redirect to Stripe Connect onboarding
      const baseUrl = window.location.origin;
      const returnUrl = `${baseUrl}/connect-return`;
      const refreshUrl = `${baseUrl}/connect-refresh`;
      
      // FIXED: Added /v2 and scope=read_write
      const stripeConnectUrl = `https://connect.stripe.com/express/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_STRIPE_CONNECT_CLIENT_ID}&state=${authData.user.id}&scope=read_write&redirect_uri=${encodeURIComponent(returnUrl)}&refresh_url=${encodeURIComponent(refreshUrl)}`;
      
      window.location.href = stripeConnectUrl;

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0b0b0d 0%, #1a0a1f 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: '-apple-system, sans-serif'
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '450px',
        width: '100%',
        backdropFilter: 'blur(10px)'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #ff006e, #00f5ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '10px',
          textAlign: 'center'
        }}>
          DJ Signup
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.6)',
          textAlign: 'center',
          marginBottom: '30px',
          fontSize: '14px'
        }}>
          Create your account and connect Stripe to start accepting payments
        </p>

        <form onSubmit={handleSignup}>
          <input
            type="text"
            placeholder="DJ Name"
            value={formData.dj_name}
            onChange={(e) => setFormData({...formData, dj_name: e.target.value})}
            required
            disabled={loading}
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
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
            disabled={loading}
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
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
            disabled={loading}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: 'white',
              fontSize: '16px',
              marginBottom: '20px'
            }}
          />

          {error && (
            <p style={{
              color: '#ff6b6b',
              marginBottom: '15px',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading 
                ? 'rgba(255,255,255,0.1)'
                : 'linear-gradient(135deg, #ff006e, #ff4d8f)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '20px',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Creating Account...' : 'Sign Up & Connect Stripe'}
          </button>

          <div style={{
            textAlign: 'center'
          }}>
            <p style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '14px',
              marginBottom: '10px'
            }}>
              Already have an account?
            </p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              disabled={loading}
              style={{
                background: 'transparent',
                color: '#00f5ff',
                border: 'none',
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                textDecoration: 'underline'
              }}
            >
              Log In
            </button>
          </div>
        </form>

        <div style={{
          marginTop: '30px',
          padding: '15px',
          background: 'rgba(0,245,255,0.05)',
          border: '1px solid rgba(0,245,255,0.2)',
          borderRadius: '10px'
        }}>
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            lineHeight: '1.6',
            margin: 0
          }}>
            <strong style={{ color: '#00f5ff' }}>Next Step:</strong> After signup, you'll be redirected to Stripe to connect your account. This allows you to receive payments directly from your events.
          </p>
        </div>
      </div>
    </div>
  );
}
