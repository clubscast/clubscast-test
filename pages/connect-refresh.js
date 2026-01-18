import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ConnectRefresh() {
  const router = useRouter();

  useEffect(() => {
    // Redirect back to dashboard if they cancelled
    setTimeout(() => {
      router.push('/dashboard');
    }, 2000);
  }, []);

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
        <h1 style={{
          color: '#FFD700',
          marginBottom: '10px'
        }}>
          Stripe Connection Cancelled
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: '14px'
        }}>
          You can connect your Stripe account later from your dashboard. Redirecting...
        </p>
      </div>
    </div>
  );
}
