import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Use service role to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, eventId, requestId } = req.body;

    if (!amount || !eventId || !requestId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get event and DJ's Stripe account
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('dj_id')
      .eq('id', eventId);

    if (eventError) throw eventError;
    
    if (!eventData || eventData.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventData[0];

    const { data: djData, error: djError } = await supabase
      .from('djs')
      .select('stripe_account_id')
      .eq('id', event.dj_id);

    if (djError) throw djError;

    if (!djData || djData.length === 0) {
      return res.status(404).json({ error: 'DJ not found' });
    }

    const dj = djData[0];

    if (!dj.stripe_account_id) {
      return res.status(400).json({ 
        error: 'DJ has not connected their Stripe account yet' 
      });
    }

    // Create payment intent on PLATFORM account with destination charge
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      application_fee_amount: Math.round(amount * 100 * 0.10), // 10% platform fee (adjust as needed)
      transfer_data: {
        destination: dj.stripe_account_id, // Send money to DJ's account
      },
      metadata: {
        eventId: String(eventId),
        requestId: String(requestId),
      },
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Stripe error:', error);
    return res.status(500).json({ error: error.message });
  }
}
