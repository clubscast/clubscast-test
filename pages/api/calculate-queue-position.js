import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { eventId, tier, requestId } = req.body;

    // Get ALL pending requests for this event
    const { data: allRequests, error } = await supabase
      .from('requests')
      .select('id, queue_position, tier_name, created_at')
      .eq('event_id', eventId)
      .eq('request_status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // First, initialize any null positions based on creation order
    let currentPos = 1;
    const initUpdates = [];
    
    allRequests.forEach(req => {
      if (req.queue_position === null || req.queue_position === undefined) {
        initUpdates.push({
          id: req.id,
          queue_position: currentPos
        });
        req.queue_position = currentPos; // Update in memory too
        currentPos++;
      } else {
        currentPos = Math.max(currentPos, req.queue_position + 1);
      }
    });

    // Apply initialization updates
    for (const update of initUpdates) {
      await supabase
        .from('requests')
        .update({ queue_position: update.queue_position })
        .eq('id', update.id);
    }

    // Now get requests excluding the new one
    const requests = allRequests.filter(r => r.id !== requestId);
    
    // Sort by position
    requests.sort((a, b) => a.queue_position - b.queue_position);

    let newPosition;
    const updates = [];

    // Determine tier level
    const isVIP = tier.includes('tier_3') || tier.includes('VIP');
    const isPriority = tier.includes('tier_2') || tier.includes('Priority');
    
    if (isVIP) {
      // VIP goes to top, but after other VIPs
      const vipRequests = requests.filter(r => 
        r.tier_name.includes('VIP') || r.tier_name.includes('tier_3')
      );
      newPosition = vipRequests.length + 1;
      
      // Shift all non-VIP requests down
      requests.forEach(req => {
        const isReqVIP = req.tier_name.includes('VIP') || req.tier_name.includes('tier_3');
        if (!isReqVIP && req.queue_position >= newPosition) {
          updates.push({
            id: req.id,
            queue_position: req.queue_position + 1
          });
        }
      });
      
    } else if (isPriority) {
      // Priority jumps 3 spots up from bottom
      const vipRequests = requests.filter(r => 
        r.tier_name.includes('VIP') || r.tier_name.includes('tier_3')
      );
      const totalExisting = requests.length;
      const vipCount = vipRequests.length;
      
      // If there are 16 existing, priority goes to position 14 (3 up from bottom at 17)
      newPosition = Math.max(vipCount + 1, totalExisting - 2);
      
      // Shift requests at this position and below down by 1
      requests.forEach(req => {
        if (req.queue_position >= newPosition) {
          updates.push({
            id: req.id,
            queue_position: req.queue_position + 1
          });
        }
      });
      
    } else {
      // Standard goes to bottom
      newPosition = requests.length + 1;
    }

    // Apply all position updates
    for (const update of updates) {
      await supabase
        .from('requests')
        .update({ queue_position: update.queue_position })
        .eq('id', update.id);
    }

    // Update the new request's position
    await supabase
      .from('requests')
      .update({ queue_position: newPosition })
      .eq('id', requestId);

    return res.status(200).json({ 
      success: true,
      position: newPosition
    });
    
  } catch (error) {
    console.error('Queue position error:', error);
    return res.status(500).json({ error: error.message });
  }
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
