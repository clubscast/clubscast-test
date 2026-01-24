import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';

export default function ConnectReturn() {
  const router = useRouter();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState('');

 useEffect(() => {
  handleStripeReturn();
}, [router.isReady, router.query]); // Added router.isReady

  const handleStripeReturn = async () => {
  // Wait for router to be ready
  if (!router.isReady) return;
  
  const { code, state: userId } = router.query;

  // If still no params, show error
  if (!code || !userId) {
    setError('Missing authorization code or state parameter');
    setStatus('error');
    return;
  }

  try {
    // Exchange code for Stripe account ID
    const response = await fetch('/api/stripe-connect-callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, userId }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    setStatus('success');
    
    // Redirect to dashboard after 2 seconds
   setTimeout(() => {
  router.push('/dashboard?from=stripe');
}, 2000);

  } catch (err) {
    setError(err.message);
    setStatus('error');
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
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center'
      }}>
        {status === 'processing' && (
          <>
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid rgba(255,255,255,0.1)',
              borderTop: '4px solid #00f5ff',
              borderRadius: '50%',
              margin: '0 auto 20px',
              animation: 'spin 1s linear infinite'
            }} />
            <h1 style={{
              color: '#00f5ff',
              marginBottom: '10px'
            }}>
              Connecting Your Stripe Account...
            </h1>
            <p style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '14px'
            }}>
              Please wait while we complete the setup
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              fontSize: '60px',
              marginBottom: '20px'
            }}>
              ✓
            </div>
            <h1 style={{
              color: '#00ff88',
              marginBottom: '10px'
            }}>
              Stripe Connected!
            </h1>
            <p style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '14px'
            }}>
              Your account is ready. Redirecting to dashboard...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              fontSize: '60px',
              marginBottom: '20px',
              color: '#ff6b6b'
            }}>
              ✕
            </div>
            <h1 style={{
              color: '#ff6b6b',
              marginBottom: '10px'
            }}>
              Connection Failed
            </h1>
            <p style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '14px',
              marginBottom: '20px'
            }}>
              {error || 'Something went wrong'}
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #ff006e, #ff4d8f)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
