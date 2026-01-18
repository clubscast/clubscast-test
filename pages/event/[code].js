import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/router';

export default function EventQueue() {
  const router = useRouter();
  const { code } = router.query;
  
  const [event, setEvent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [raterName, setRaterName] = useState('');
  const [hasRated, setHasRated] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState('');

  useEffect(() => {
    if (code) {
      loadEventAndRequests();
    }
  }, [code]);

  useEffect(() => {
    if (event) {
      const interval = setInterval(loadRequests, 5000);
      return () => clearInterval(interval);
    }
  }, [event]);

  const loadEventAndRequests = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('event_code', code)
        .single();

      if (eventError) throw eventError;
      
      setEvent(eventData);
      await loadRequests(eventData.id);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const loadRequests = async (eventId = event?.id) => {
    if (!eventId) return;

    const { data } = await supabase
      .from('requests')
      .select('*')
      .eq('event_id', eventId)
      .eq('request_status', 'pending')
      .order('submitted_at', { ascending: true });

    setRequests(data || []);
  };

  const submitRating = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!raterName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    try {
      const { error: ratingError } = await supabase
        .from('ratings')
        .insert([{
          event_id: event.id,
          requester_name: raterName.trim(),
          rating: rating
        }]);

      if (ratingError) {
        if (ratingError.code === '23505') {
          setError('You have already rated this event');
        } else {
          throw ratingError;
        }
        return;
      }

      const { data: allRatings } = await supabase
        .from('ratings')
        .select('rating')
        .eq('event_id', event.id);

      const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;

      await supabase
        .from('events')
        .update({
          average_rating: avgRating.toFixed(2),
          total_ratings: allRatings.length
        })
        .eq('id', event.id);

      const { data: djEvents } = await supabase
        .from('events')
        .select('average_rating')
        .eq('dj_id', event.dj_id)
        .gt('total_ratings', 0);

      if (djEvents && djEvents.length > 0) {
        const djOverallRating = djEvents.reduce((sum, e) => sum + parseFloat(e.average_rating), 0) / djEvents.length;
        
        await supabase
          .from('djs')
          .update({ overall_rating: djOverallRating.toFixed(2) })
          .eq('id', event.dj_id);
      }

      setRatingSuccess('Thank you for your rating!');
      setHasRated(true);
      setShowRating(false);
      setRating(0);
      setRaterName('');
      
      loadEventAndRequests();

    } catch (err) {
      setError(err.message);
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

  if (error && !event) {
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
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,0,0,0.3)',
          padding: '40px',
          borderRadius: '20px',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h1 style={{ color: '#ff6b6b', marginBottom: '10px' }}>
            Event Not Found
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>
            {error || 'This event code is invalid or has been deleted.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0b0b0d 0%, #1a0a1f 100%)',
      color: '#eef',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
          paddingTop: '20px'
        }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #ff006e, #00f5ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '10px'
          }}>
            {event.event_name}
          </h1>
          
          {event.total_ratings > 0 && (
            <div style={{
              color: '#FFD700',
              fontSize: '20px',
              marginBottom: '10px'
            }}>
              {'★'.repeat(Math.round(parseFloat(event.average_rating)))}{'☆'.repeat(5 - Math.round(parseFloat(event.average_rating)))}
              <span style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: '14px',
                marginLeft: '10px'
              }}>
                ({event.average_rating}/5 - {event.total_ratings} {event.total_ratings === 1 ? 'rating' : 'ratings'})
              </span>
            </div>
          )}
          
          <p style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: '16px',
            marginBottom: '5px'
          }}>
            {event.venue}
          </p>
          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '14px'
          }}>
            {new Date(event.event_date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>

        {/* Success Message */}
        {ratingSuccess && (
          <div style={{
            background: 'rgba(0,255,136,0.1)',
            border: '1px solid rgba(0,255,136,0.3)',
            padding: '15px',
            borderRadius: '10px',
            marginBottom: '20px',
            textAlign: 'center',
            color: '#00ff88'
          }}>
            {ratingSuccess}
          </div>
        )}

        {/* Buttons */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '15px',
          justifyContent: 'center'
        }}>
          <button
            onClick={() => router.push(`/event/${code}/request`)}
            style={{
              padding: '16px 40px',
              background: 'linear-gradient(135deg, #ff006e, #ff4d8f)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(255,0,110,0.4)',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            Request a Song
          </button>
          
          <button
            onClick={() => setShowRating(true)}
            disabled={hasRated}
            style={{
              padding: '16px 40px',
              background: hasRated 
                ? 'rgba(255,255,255,0.1)' 
                : 'linear-gradient(135deg, #FFD700, #FFA500)',
              color: hasRated ? 'rgba(255,255,255,0.5)' : 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '700',
              cursor: hasRated ? 'not-allowed' : 'pointer',
              boxShadow: hasRated ? 'none' : '0 4px 20px rgba(255,215,0,0.4)',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => !hasRated && (e.target.style.transform = 'scale(1.05)')}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            {hasRated ? 'Already Rated' : 'Rate This Event'}
          </button>
        </div>

        {/* Rating Modal */}
        {showRating && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: '#0b0b0d',
              border: '2px solid rgba(255,215,0,0.3)',
              borderRadius: '20px',
              padding: '40px',
              maxWidth: '500px',
              width: '100%'
            }}>
              <h2 style={{
                color: '#FFD700',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                Rate This Event
              </h2>

              <form onSubmit={submitRating}>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={raterName}
                  onChange={(e) => setRaterName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '14px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '16px',
                    marginBottom: '20px'
                  }}
                />

                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '15px',
                  marginBottom: '20px'
                }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '40px',
                        color: star <= rating ? '#FFD700' : 'rgba(255,255,255,0.2)',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    >
                      ★
                    </button>
                  ))}
                </div>

                {error && (
                  <p style={{
                    color: '#ff6b6b',
                    textAlign: 'center',
                    marginBottom: '15px',
                    fontSize: '14px'
                  }}>
                    {error}
                  </p>
                )}

                <div style={{
                  display: 'flex',
                  gap: '10px'
                }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '16px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Submit Rating
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRating(false);
                      setError('');
                      setRating(0);
                      setRaterName('');
                    }}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '10px',
                      fontSize: '16px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Queue Section */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '30px',
          backdropFilter: 'blur(10px)'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '700',
            marginBottom: '20px',
            color: '#00f5ff',
            textAlign: 'center'
          }}>
            Song Queue
          </h2>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {requests.length === 0 ? (
              <p style={{
                textAlign: 'center',
                color: 'rgba(255,255,255,0.4)',
                padding: '40px 20px',
                fontSize: '16px'
              }}>
                No songs in queue yet. Be the first to request!
              </p>
            ) : (
              requests.map((request, index) => (
                <div
                  key={request.id}
                  style={{
                    background: request.used_host_code 
                      ? `${event.host_code_color}15`
                      : 'rgba(255,255,255,0.05)',
                    border: request.used_host_code
                      ? `2px solid ${event.host_code_color}`
                      : '1px solid rgba(255,255,255,0.1)',
                    padding: '18px',
                    borderRadius: '12px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '15px'
                  }}>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: request.used_host_code ? event.host_code_color : '#00f5ff',
                      minWidth: '30px'
                    }}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        marginBottom: '5px',
                        color: '#fff'
                      }}>
                        {request.song}
                      </div>
                      <div style={{
                        fontSize: '15px',
                        color: 'rgba(255,255,255,0.7)',
                        marginBottom: '8px'
                      }}>
                        {request.artist}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.5)'
                      }}>
                        Requested by {request.requester_name}
                        {request.used_host_code && (
                          <span style={{
                            marginLeft: '10px',
                            padding: '2px 8px',
                            background: `${event.host_code_color}30`,
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            color: event.host_code_color
                          }}>
                            HOST
                          </span>
                        )}
                      </div>
                      {request.message && (
                        <div style={{
                          marginTop: '10px',
                          padding: '10px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontStyle: 'italic',
                          color: 'rgba(255,255,255,0.6)'
                        }}>
                          "{request.message}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '40px',
          paddingBottom: '20px'
        }}>
          <p style={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: '14px'
          }}>
            Powered by ClubsCast
          </p>
        </div>
      </div>
    </div>
  );
}
