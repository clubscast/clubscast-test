import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Use service role for API routes (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // This is the key change!
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, userId } = req.body;

    if (!code || !userId) {
      return res.status(400).json({ error: 'Missing code or userId' });
    }

    // Exchange authorization code for Stripe account ID
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code: code,
    });

    const stripeAccountId = response.stripe_user_id;

    // Update DJ record with Stripe account ID
    const { error: updateError } = await supabase
      .from('djs')
      .update({ stripe_account_id: stripeAccountId })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({ 
      success: true,
      stripeAccountId: stripeAccountId
    });
  } catch (error) {
    console.error('Stripe Connect error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

**Get your Service Role Key:**
1. Go to **Supabase Dashboard → Settings → API**
2. Copy the **`service_role`** key (NOT the anon key)
3. Add it to your `.env.local`:
```
   SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
