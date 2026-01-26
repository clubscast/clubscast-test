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
  const [showCheckout, setShowCheckout] = useState(false);

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
      const interval = setInterval(loadEvent, 5000);
      return () => clearInterval(interval);
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

  const handleContinueToCheckout = (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.requester_name || !formData.song || !formData.artist) {
      setError('Please fill in all required fields');
      return;
    }

    const isFreeRequest = !event.require_payment || hostCodeValid;
    
    if (!isFreeRequest && !cardComplete) {
      setError('Please enter your credit card information');
      return;
    }

    setShowCheckout(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setProcessing(true);

    try {
      const selectedTier = formData.tier;
      const djPrice = event[`${selectedTier}_price`];
      const serviceFee = (djPrice * 0.08) + 0.30;
      const totalAmount = djPrice + serviceFee;
      const tierName = event[`${selectedTier}_name`];
      const isFreeRequest = !event.require_payment || hostCodeValid;

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
          dj_price: isFreeRequest ? 0 : djPrice,
          service_fee: isFreeRequest ? 0 : serviceFee,
          amount: isFreeRequest ? 0 : totalAmount,
          payment_status: isFreeRequest ? 'free' : 'authorized',
          request_status: 'pending',
          used_host_code: hostCodeValid
        }])
        .select();

      if (insertError) throw insertError;

      if (!requestDataArray || requestDataArray.length === 0) {
        throw new Error('No data returned from insert');
      }

      const requestData = requestDataArray[0];

      // Queue positioning
      const { data: existingRequests } = await supabase
        .from('requests')
        .select('id, queue_position, tier_name')
        .eq('event_id', event.id)
        .eq('request_status', 'pending')
        .neq('id', requestData.id)
        .order('queue_position', { ascending: true, nullsFirst: false });

      const totalExisting = existingRequests?.length || 0;
      const vipCount = existingRequests?.filter(r => 
        r.tier_name.toLowerCase().includes('vip') || 
        r.tier_name.toLowerCase().includes('tier_3')
      ).length || 0;

      let newPosition;
      const effectiveTier = hostCodeValid ? 'tier_3' : tierName;

      if (effectiveTier.toLowerCase().includes('vip') || effectiveTier.toLowerCase().includes('tier_3')) {
        newPosition = vipCount + 1;
      } else if (effectiveTier.toLowerCase().includes('priority') || effectiveTier.toLowerCase().includes('tier_2')) {
        newPosition = Math.max(vipCount + 1, totalExisting - 2);
      } else {
        newPosition = totalExisting + 1;
      }

      if (existingRequests && existingRequests.length > 0) {
        const requestsToShift = existingRequests.filter(r => r.queue_position >= newPosition);
        for (const req of requestsToShift) {
          await supabase
            .from('requests')
            .update({ queue_position: req.queue_position + 1 })
            .eq('id', req.id);
        }
      }

      await supabase
        .from('requests')
        .update({ queue_position: newPosition })
        .eq('id', requestData.id);

      // If free request, we're done
      if (isFreeRequest) {
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
          router.push(`/event/${eventCode}`);
        }, 2000);
        return;
      }

      // Process payment authorization
      if (!stripe || !elements) {
        throw new Error('Stripe not loaded');
      }

      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          djPrice: djPrice,
          totalAmount: totalAmount,
          eventId: event.id,
          requestId: requestData.id,
        }),
      });

      const { clientSecret, error: intentError } = await response.json();
      if (intentError) throw new Error(intentError);

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            name: formData.requester_name,
          },
        },
      });

      if (stripeError) {
        await supabase
          .from('requests')
          .update({ 
            payment_status: 'failed',
            request_status: 'rejected'
          })
          .eq('id', requestData.id);
        
        throw new Error(stripeError.message);
      }

      await supabase
        .from('requests')
        .update({ 
          payment_status: 'authorized',
          stripe_payment_id: paymentIntent.id
        })
        .eq('id', requestData.id);

      setSuccess(true);
      setTimeout(() => {
        router.push(`/event/${eventCode}`);
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

  const acceptingStatus = event.accepting_requests || 'open';

  if (acceptingStatus === 'paused') {
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
          background: 'rgba(255,215,0,0.1)',
          border: '2px solid #FFD700',
          padding: '40px',
          borderRadius: '20px',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏸️</div>
          <h1 style={{ 
            color: '#FFD700',
            marginBottom: '20px',
            fontSize: '28px'
          }}>
            Requests Paused
          </h1>
          <p style={{ 
            color: 'rgba(255,255,255,0.8)',
            marginBottom: '20px',
            lineHeight: '1.6'
          }}>
            {event.pause_message || 'Thank you for all the requests. I am catching up and will open it again soon.'}
          </p>
          <button
            onClick={() => router.push(`/event/${eventCode}`)}
            style={{
              padding: '12px 24px',
              background: 'rgba(255,215,0,0.2)',
              color: '#FFD700',
              border: '1px solid #FFD700',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Back to Queue
          </button>
        </div>
      </div>
    );
  }

  if (acceptingStatus === 'ended') {
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
          background: 'rgba(255,0,110,0.1)',
          border: '2px solid #ff006e',
          padding: '40px',
          borderRadius: '20px',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🏁</div>
          <h1 style={{ 
            color: '#ff006e',
            marginBottom: '20px',
            fontSize: '28px'
          }}>
            Event Ended
          </h1>
          <p style={{ 
            color: 'rgba(255,255,255,0.8)',
            marginBottom: '20px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap'
          }}>
            {event.end_message || 'Thanks for an amazing night! This event has ended.'}
          </p>
          <button
            onClick={() => router.push(`/event/${eventCode}`)}
            style={{
              padding: '12px 24px',
              background: 'rgba(255,0,110,0.2)',
              color: '#ff006e',
              border: '1px solid #ff006e',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Back to Queue
          </button>
        </div>
      </div>
    );
  }

  const isFreeEvent = !event.require_payment;
  const isFreeRequest = isFreeEvent || hostCodeValid;
  const selectedTier = formData.tier;
  const djPrice = event[`${selectedTier}_price`];
  const serviceFee = (djPrice * 0.08) + 0.30;
  const totalAmount = djPrice + serviceFee;
  const tierName = event[`${selectedTier}_name`];

  // CHECKOUT SCREEN
  if (showCheckout && !isFreeRequest) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0b0b0d',
        padding: '20px',
        fontFamily: '-apple-system, sans-serif'
      }}>
        <div style={{
          maxWidth: '500px',
          margin: '0 auto',
          paddingTop: '40px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '30px'
          }}>
            <button
              onClick={() => setShowCheckout(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#00f5ff',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '0',
                marginRight: '15px'
              }}
            >
              ←
            </button>
            <h1 style={{
              color: 'white',
              fontSize: '28px',
              margin: '0'
            }}>
              Confirm Request
            </h1>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.05)',
            padding: '20px',
            borderRadius: '15px',
            marginBottom: '25px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h2 style={{
              color: 'white',
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '8px'
            }}>
              {event.event_name}
            </h2>
            <p style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '14px',
              margin: '0'
            }}>
              {event.venue}
            </p>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.03)',
            padding: '20px',
            borderRadius: '15px',
            marginBottom: '25px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '12px',
              marginBottom: '15px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Your Request
            </div>
            <div style={{
              color: 'white',
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '5px'
            }}>
              {formData.song}
            </div>
            <div style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '15px',
              marginBottom: '10px'
            }}>
              {formData.artist}
            </div>
            <div style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: '13px'
            }}>
              Requested by {formData.requester_name}
            </div>
          </div>

          <div style={{
            marginBottom: '25px'
          }}>
            <div style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '14px',
              marginBottom: '12px',
              fontWeight: '600'
            }}>
              Payment Method
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '15px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{
                padding: '12px',
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
                  marginTop: '10px',
                  marginBottom: '0'
                }}>
                  {cardError}
                </p>
              )}
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.03)',
            padding: '20px',
            borderRadius: '15px',
            marginBottom: '20px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '14px',
              marginBottom: '15px',
              fontWeight: '600'
            }}>
              Summary
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px' }}>
                {tierName}
              </span>
              <span style={{ color: 'white', fontSize: '15px' }}>
                ${djPrice.toFixed(2)}
              </span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '15px',
              paddingBottom: '15px',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px' }}>
                Service Fee
              </span>
              <span style={{ color: 'white', fontSize: '15px' }}>
                ${serviceFee.toFixed(2)}
              </span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ color: 'white', fontSize: '18px', fontWeight: '700' }}>
                Total
              </span>
              <span style={{ color: '#00f5ff', fontSize: '24px', fontWeight: '700' }}>
                ${totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          <div style={{
            background: 'rgba(255,215,0,0.1)',
            border: '1px solid rgba(255,215,0,0.3)',
            padding: '15px',
            borderRadius: '10px',
            marginBottom: '20px'
          }}>
            <div style={{
              color: '#FFD700',
              fontSize: '13px',
              lineHeight: '1.5',
              textAlign: 'center'
            }}>
              💳 Your card will be authorized but not charged until the DJ approves your request
            </div>
          </div>

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
            onClick={handleSubmit}
            disabled={processing || !cardComplete}
            style={{
              width: '100%',
              padding: '18px',
              background: processing || !cardComplete
                ? 'rgba(255,255,255,0.1)'
                : 'linear-gradient(135deg, #ff006e, #ff4d8f)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: processing || !cardComplete ? 'not-allowed' : 'pointer',
              opacity: processing || !cardComplete ? 0.5 : 1,
              marginBottom: '10px'
            }}
          >
            {processing ? 'Processing...' : 'Authorize Payment'}
          </button>

          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '11px',
            textAlign: 'center',
            margin: '0'
          }}>
            By submitting, you agree to the Terms of Service
          </p>
        </div>
      </div>
    );
  }

  // REGULAR REQUEST FORM
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0b0d',
      padding: '20px',
      fontFamily: '-apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        paddingTop: '40px'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,0,110,0.2)',
          borderRadius: '20px',
          padding: '40px'
        }}>
          <h1 style={{
            color: '#ff6b35',
            marginBottom: '10px',
            fontSize: '32px',
            textAlign: 'center'
          }}>
            Request a Song
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.6)',
            textAlign: 'center',
            marginBottom: '30px',
            fontSize: '14px'
          }}>
            {event.event_name}
          </p>

          <form onSubmit={isFreeRequest ? handleSubmit : handleContinueToCheckout}>
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
                borderRadius: '8px',
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
                borderRadius: '8px',
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
                borderRadius: '8px',
                color: 'white',
                fontSize: '16px',
                marginBottom: '15px'
              }}
            />

            <textarea
              placeholder="Message (Optional)"
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              disabled={processing}
              rows="3"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '16px',
                marginBottom: '20px',
                resize: 'vertical',
                fontFamily: '-apple-system, sans-serif'
              }}
            />

            {event.host_code && (
              <div style={{ marginBottom: '20px' }}>
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
                  placeholder="Enter host code for VIP access"
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
                    ✓ Valid code! VIP access granted
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
                      ${event[`${tier.key}_price`].toFixed(2)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {hostCodeValid && (
            <div style={{
              padding: '15px',
              background: 'rgba(255,215,0,0.1)',
              border: '1px solid rgba(255,215,0,0.3)',
              borderRadius: '10px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              <p style={{
                color: '#FFD700',
                fontSize: '16px',
                fontWeight: '600',
                margin: '0 0 5px 0'
              }}>
                VIP Access Granted!
              </p>
              <p style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: '13px',
                margin: '0'
              }}>
                Your request will go to the top of the queue
              </p>
            </div>
          )}

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
              disabled={processing}
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
                  : 'Continue to Checkout'}
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
