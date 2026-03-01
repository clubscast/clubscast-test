import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Use service role for API routes (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Stripe OAuth redirects use GET method
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get code and state from query parameters
    const { code, state } = req.query;
    const userId = state; // state contains the user ID we passed

    if (!code || !userId) {
      console.error('Missing parameters:', { code: !!code, userId: !!userId });
      return res.status(400).send(`
        <html>
          <body style="background: #0a0a0f; color: #ff006e; font-family: system-ui; padding: 40px; text-align: center;">
            <h1>Error: Missing required parameters</h1>
            <p>Please try signing up again.</p>
            <a href="/signup" style="color: #00f5ff;">Return to Signup</a>
          </body>
        </html>
      `);
    }

    console.log('Processing Stripe OAuth callback for user:', userId);

    // Exchange authorization code for Stripe account ID
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code: code,
    });

    const stripeAccountId = response.stripe_user_id;
    console.log('Received Stripe account ID:', stripeAccountId);

    // Update DJ record with Stripe account ID
    const { error: updateError } = await supabase
      .from('djs')
      .update({ stripe_account_id: stripeAccountId })
      .eq('id', userId);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw updateError;
    }

    console.log('Successfully saved Stripe account ID to database');

    // Success page - user can close this tab
    return res.status(200).send(`
      <html>
        <head>
          <title>Stripe Connected!</title>
        </head>
        <body style="background: #0a0a0f; color: #00f5ff; font-family: system-ui; padding: 40px; text-align: center;">
          <div style="max-width: 500px; margin: 0 auto; background: #1a1a1f; border: 1px solid #ff006e; border-radius: 12px; padding: 40px;">
            <h1 style="color: #ff006e; text-shadow: 0 0 10px rgba(255, 0, 110, 0.5); margin-bottom: 20px;">
              ✓ Stripe Connected!
            </h1>
            <p style="color: #e0e0e0; font-size: 18px; margin-bottom: 30px;">
              Your Stripe account has been successfully connected.
            </p>
            <p style="color: #00f5ff; font-size: 14px; margin-bottom: 20px;">
              You can now close this tab and return to your dashboard.
            </p>
            <button 
              onclick="window.close()" 
              style="background: linear-gradient(135deg, #ff006e, #00f5ff); color: #0a0a0f; border: none; padding: 15px 40px; font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer; box-shadow: 0 0 20px rgba(255, 0, 110, 0.3);"
            >
              Close Tab
            </button>
            <br><br>
            <a href="/dashboard" style="color: #00f5ff; text-decoration: none; font-size: 14px;">
              Or go to Dashboard →
            </a>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Stripe OAuth callback error:', error);
    return res.status(500).send(`
      <html>
        <body style="background: #0a0a0f; color: #ff006e; font-family: system-ui; padding: 40px; text-align: center;">
          <h1>Connection Error</h1>
          <p style="color: #e0e0e0;">There was an error connecting your Stripe account:</p>
          <p style="color: #ff006e; font-family: monospace;">${error.message}</p>
          <a href="/dashboard" style="color: #00f5ff; text-decoration: none;">Return to Dashboard</a>
        </body>
      </html>
    `);
  }
}
