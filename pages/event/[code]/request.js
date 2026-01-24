import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/router';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

function RequestFormContent({ eventCode }) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cardError, setCardError] = useState('');
  const [cardComplete, setCardComplete] = useState(false);

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
    if (eventCode) {
      loadEvent();
    }
  }, [eventCode]);

  const loadEvent = async () => {
    try {
      if (!eventCode) {
        throw new Error('Event code not found');
      }

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('event_code', eventCode.toUpperCase());

      if (eventError) throw eventError;
      
      if (!eventData || eventData.length === 0) {
        throw new Error('Event not found. Please check the event code.');
      }

      setEvent(eventData[0]);
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
  setProcessing(true);

  try {
    const selectedTier = formData.tier;
    const amount = event[`${selectedTier}_price`];
    const tierName = event[`${selectedTier}_name`];
    const isFreeRequest = !event.require_payment || hostCodeValid;

    // Check if card info is required but not complete
    if (!isFreeRequest && !cardComplete) {
      setError('Please enter your credit card information');
      setProcessing(false);
      return;
    }

    // Insert request into database first
    const { data: requestDataArray, error: insertError } = await supabase
      .from('requests')
      .insert([{
        event_id: event.id,
        requester_name: formData.requester_name,
        song: formData.song,
        artist: formData.artist,
        message: formData.message || null,
        tier_name: tierName,
        amount: isFreeRequest ? 0 : amount,
        payment_status: isFreeRequest ? 'free' : 'pending',
        request_status: 'pending',
        used_host_code: hostCodeValid
      }])
      .select();

    if (insertError) throw insertError;

    if (!requestDataArray || requestDataArray.length === 0) {
      throw new Error('No data returned from insert');
    }

    const requestData = requestDataArray[0];

    // Calculate and set queue position based on tier
    await fetch('/api/calculate-queue-position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: event.id,
        tier: tierName,
        requestId: requestData.id
      }),
    });

    // If free request, we're done
    if (isFreeRequest) {
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
        const code = router.query.code || eventCode;
        router.push(`/event/${code}`);
      }, 2000);
      return;
    }

    // Process payment for paid requests
    if (!stripe || !elements) {
      throw new Error('Stripe not loaded');
    }

    // Create payment intent
    const response = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount,
        eventId: event.id,
        requestId: requestData.id,
      }),
    });

    const { clientSecret, error: intentError } = await response.json();
    if (intentError) throw new Error(intentError);

    // Confirm payment
    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement),
        billing_details: {
          name: formData.requester_name,
        },
      },
    });

    if (stripeError) {
      // Payment failed - update request status
      await supabase
        .from('requests')
        .update({ 
          payment_status: 'failed',
          request_status: 'rejected'
        })
        .eq('id', requestData.id);
      
      throw new Error(stripeError.message);
    }

    // Payment succeeded - update request
    await supabase
      .from('requests')
      .update({ 
        payment_status: 'captured',
        stripe_payment_id: paymentIntent.id
      })
      .eq('id', requestData.id);

    setSuccess(true);
    setTimeout(() => {
      const code = router.query.code || eventCode;
      router.push(`/event/${code}`);
    }, 2000);

  } catch (err) {
    setError(err.message);
    setProcessing(false);
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
              disabled={processing}
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
              disabled={processing}
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
              disabled={processing}
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
              disabled={processing}
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
                  disabled={processing}
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
                {[
                  { key: 'tier_1', desc: 'Goes to bottom of queue' },
                  { key: 'tier_2', desc: 'Jumps 3 songs up the queue' },
                  { key: 'tier_3', desc: 'Goes to top (below other VIPs)' }
                ].map(tier => (
                  <label
                    key={tier.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px',
                      background: formData.tier === tier.key ? 'rgba(255,0,110,0.2)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${formData.tier === tier.key ? '#ff006e' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '8px',
                      cursor: processing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: processing ? 0.5 : 1
                    }}
                  >
                    <input
                      type="radio"
                      name="tier"
                      value={tier.key}
                      checked={formData.tier === tier.key}
                      onChange={(e) => setFormData({...formData, tier: e.target.value})}
                      disabled={processing}
                      style={{ marginRight: '10px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        color: 'white',
                        fontWeight: '600',
                        marginBottom: '4px'
                      }}>
                        {event[`${tier.key}_name`]}
                      </div>
                      <div style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '12px'
                      }}>
                        {tier.desc}
                      </div>
                    </div>
                    <span style={{
                      color: '#00f5ff',
                      fontWeight: '700',
                      fontSize: '18px'
                    }}>
                      ${event[`${tier.key}_price`]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

            {/* Payment Card - Only show if payment required and no valid host code */}
            {event.require_payment && !hostCodeValid && (
              <div style={{
                padding: '15px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                marginBottom: '20px'
              }}>
                <label style={{
                  display: 'block',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '14px',
                  marginBottom: '12px'
                }}>
                  Card Details
                </label>
                <div style={{
                  padding: '14px',
                  background: 'white',
                  borderRadius: '8px'
                }}>
                  <CardElement
                    options={{
                      style: {
                        base: {
                          fontSize: '16px',
                          color: '#0b0b0d',
                          '::placeholder': {
                            color: '#999',
                          },
                        },
                      },
                    }}
                    onChange={(e) => {
                      setCardComplete(e.complete);
                      setCardError(e.error ? e.error.message : '');
                    }}
                  />
                </div>
                {cardError && (
                  <p style={{
                    color: '#ff6b6b',
                    fontSize: '13px',
                    marginTop: '8px',
                    marginBottom: '0'
                  }}>
                    {cardError}
                  </p>
                )}
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
              disabled={processing || (!isFreeRequest && (!stripe || !elements))}
              style={{
                width: '100%',
                padding: '16px',
                background: processing 
                  ? 'rgba(255,255,255,0.1)'
                  : isFreeRequest 
                    ? 'linear-gradient(135deg, #00ff88, #00cc6a)'
                    : 'linear-gradient(135deg, #ff006e, #ff4d8f)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '18px',
                fontWeight: '700',
                cursor: processing ? 'not-allowed' : 'pointer',
                opacity: processing ? 0.6 : 1,
                boxShadow: isFreeRequest
                  ? '0 4px 20px rgba(0,255,136,0.4)'
                  : '0 4px 20px rgba(255,0,110,0.4)'
              }}
            >
              {processing 
                ? 'Processing...' 
                : isFreeRequest 
                  ? 'Submit Free Request' 
                  : `Pay $${event[`${formData.tier}_price`]} & Submit`}
            </button>
          </form>

          <button
            onClick={() => router.push(`/event/${eventCode}`)}
            disabled={processing}
            style={{
              width: '100%',
              marginTop: '15px',
              padding: '12px',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              fontSize: '14px',
              cursor: processing ? 'not-allowed' : 'pointer',
              opacity: processing ? 0.5 : 1
            }}
          >
            Back to Queue
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RequestForm() {
  const router = useRouter();
  const { code } = router.query;

  return (
    <Elements stripe={stripePromise}>
      <RequestFormContent eventCode={code} />
    </Elements>
  );
}
