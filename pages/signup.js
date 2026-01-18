import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [djName, setDjName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
            stripe_account_id: null // Will be set after Stripe Connect
          }
        ]);

      if (djError) throw djError;

      // Redirect to Stripe Connect onboarding
      const returnUrl = `${window.location.origin}/connect-return`;
      const refreshUrl = `${window.location.origin}/connect-refresh`;
      
      const stripeConnectUrl = `https://connect.stripe.com/express/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_STRIPE_CONNECT_CLIENT_ID}&state=${authData.user.id}&redirect_uri=${returnUrl}&refresh_url=${refreshUrl}`;
      
      window.location.href = stripeConnectUrl;

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };
  
    // Success - redirect to dashboard
    router.push('/dashboard');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a1a 100%)',
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
        width: '100%',
        boxShadow: '0 0 60px rgba(255,0,110,0.3)'
      }}>
        <h1 style={{
          fontSize: '32px',
          marginBottom: '10px',
          color: '#ff006e',
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
          Create your ClubsCast account
        </p>

        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: 'rgba(255,255,255,0.8)',
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              DJ Name
            </label>
            <input
              type="text"
              value={djName}
              onChange={(e) => setDjName(e.target.value)}
              placeholder="JINKZ"
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
              fontSize: '14px'
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
              fontSize: '14px'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
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
          </div>

          {error && (
            <div style={{
              padding: '12px',
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
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#666' : 'linear-gradient(135deg, #00f5ff, #00b8d4)',
              color: loading ? 'white' : '#0a0a0a',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '15px'
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <div style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '14px'
          }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: '#ff006e', textDecoration: 'none' }}>
              Login
            </a>
          </div>
        </form>

        <div style={{
          marginTop: '30px',
          textAlign: 'center'
        }}>
          <a href="/" style={{
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
