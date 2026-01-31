import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { djId } = req.query;

    if (!djId) {
      return res.status(400).json({ error: 'DJ ID required' });
    }

    // Get overall stats for this DJ
    const { data: stats, error } = await supabase
      .from('dj_overall_stats')
      .select('*')
      .eq('dj_id', djId)
      .single();

    if (error) {
      // If no stats found, return zeros
      if (error.code === 'PGRST116') {
        return res.status(200).json({
          success: true,
          stats: {
            totalEvents: 0,
            totalRatings: 0,
            averageRating: 0,
            ratedEvents: 0
          }
        });
      }
      throw error;
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalEvents: stats?.total_events || 0,
        totalRatings: stats?.total_ratings || 0,
        averageRating: parseFloat(stats?.overall_average_rating || 0),
        ratedEvents: stats?.rated_events || 0
      }
    });

  } catch (error) {
    console.error('Public stats error:', error);
    return res.status(500).json({ 
      error: error.message,
      stats: {
        totalEvents: 0,
        totalRatings: 0,
        averageRating: 0,
        ratedEvents: 0
      }
    });
  }
}
