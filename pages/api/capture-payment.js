import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: 'Missing request ID' });
    }

    // Get request with payment intent ID
    const { data: requestData, error: fetchError } = await supabase
      .from('requests')
      .select('stripe_payment_id, payment_status')
      .eq('id', requestId);

    if (fetchError) throw fetchError;

    if (!requestData || requestData.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestData[0];

    if (!request.stripe_payment_id) {
      return res.status(400).json({ error: 'No payment to capture' });
    }

    if (request.payment_status !== 'authorized') {
      return res.status(400).json({ error: 'Payment not in authorized state' });
    }

    // Capture the payment
    const paymentIntent = await stripe.paymentIntents.capture(request.stripe_payment_id);

    // Update request status
    await supabase
      .from('requests')
      .update({ 
        payment_status: 'captured',
        request_status: 'approved'
      })
      .eq('id', requestId);

    return res.status(200).json({ 
      success: true,
      paymentIntent: paymentIntent.id
    });

  } catch (error) {
    console.error('Capture error:', error);
    return res.status(500).json({ error: error.message });
  }
}
