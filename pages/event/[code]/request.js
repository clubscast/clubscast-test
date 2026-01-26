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
