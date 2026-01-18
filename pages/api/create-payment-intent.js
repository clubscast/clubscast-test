import Stripe from 'stripe';
import { supabase } from '../../lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, eventId, requestId } = req.body;

    // Get event and DJ's Stripe account
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('dj_id')
      .eq('id', eventId)
      .single();

    if (eventError) throw eventError;

    const { data: dj, error: djError } = await supabase
      .from('djs')
      .select('stripe_account_id')
      .eq('id', event.dj_id)
      .single();

    if (djError) throw djError;

    if (!dj.stripe_account_id) {
      return res.status(400).json({ 
        error: 'DJ has not connected their Stripe account yet' 
      });
    }

    // Create payment intent on DJ's connected account
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        eventId: String(eventId),
        requestId: String(requestId),
      },
    }, {
      stripeAccount: dj.stripe_account_id, // Charge DJ's account directly
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Stripe error:', error);
    return res.status(500).json({ error: error.message });
  }
}
