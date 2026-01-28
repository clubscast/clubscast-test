import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/router';

export default function EventDetails() {
  const router = useRouter();
  const { code } = router.query;
  
  const [event, setEvent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, approved, rejected

  useEffect(() => {
    if (code) {
      loadEventDetails();
    }
  }, [code]);

  const loadEventDetails = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('event_code', code.toUpperCase())
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      const { data: requestsData, error: requestsError } = await supabase
        .from('requests')
        .select('*')
        .eq('event_id', eventData.id)
        .order('created_at', { ascending: true });

      if (requestsError) throw requestsError;
      setRequests(requestsData || []);
      setLoading(false);
    } catch (err) {
      console.error('Error loading event:', err);
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!requests || requests.length === 0) {
      alert('No requests to export');
      return;
    }

    // Create CSV content
    const headers = [
      'Position',
      'Status',
      'Song',
      'Artist',
      'Requester',
      'Tier',
      'DJ Price',
      'Service Fee',
      'Total Amount',
      'Payment Status',
      'Message',
      'Time Requested',
      'Host Code Used'
    ];

    const csvRows = [
      headers.join(','),
      ...requests.map((req, index) => {
        const row = [
          req.queue_position || (index + 1),
          req.request_status,
          `"${req.song}"`,
          `"${req.artist}"`,
          `"${req.requester_name}"`,
          req.tier_name,
          req.dj_price || 0,
          req.service_fee || 0,
          req.amount || 0,
          req.payment_status,
          `"${req.message || ''}"`,
          new Date(req.created_at).toLocaleString(),
          req.used_host_code ? 'Yes' : 'No'
        ];
        return row.join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.event_name.replace(/\s+/g, '_')}_${code}_requests.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
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

  if (!event) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0b0b0d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        Event not found
      </div>
    );
  }

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    return req.request_status === filter;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.request_status === 'pending').length,
    approved: requests.filter(r => r.request_status === 'approved').length,
    rejected: requests.filter(r => r.request_status === 'rejected').length,
    earnings: requests
      .filter(r => r.request_status === 'approved')
      .reduce((sum, r) => sum + (r.dj_price || 0), 0)
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0b0d',
      color: '#eef',
      padding: '20px',
      fontFamily: '-apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '30px',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div>
            <button
              onClick={() => router.push('/dj/events')}
              style={{
                background: 'none',
                border: 'none',
                color: '#00f5ff',
                fontSize: '14px',
                cursor: 'pointer',
                marginBottom: '10px',
                padding: '0'
              }}
            >
              ← Back to Events
            </button>
            <h1 style={{ color: '#ff6b35', margin: '0 0 5px 0', fontSize: '32px' }}>
              {event.event_name}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0', fontSize: '14px' }}>
              {event.venue} • {new Date(event.event_date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          <button
            onClick={handleExportCSV}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #00ff88, #00cc6a)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0,255,136,0.3)'
            }}
          >
            📥 Export CSV
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '15px',
          marginBottom: '30px'
        }}>
          <div style={{
            padding: '20px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '8px' }}>
              Total Requests
            </div>
            <div style={{ color: 'white', fontSize: '32px', fontWeight: '700' }}>
              {stats.total}
            </div>
          </div>

          <div style={{
            padding: '20px',
            background: 'rgba(255,215,0,0.1)',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '8px' }}>
              Pending
            </div>
            <div style={{ color: '#FFD700', fontSize: '32px', fontWeight: '700' }}>
              {stats.pending}
            </div>
          </div>

          <div style={{
            padding: '20px',
            background: 'rgba(0,255,136,0.1)',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '8px' }}>
              Played
            </div>
            <div style={{ color: '#00ff88', fontSize: '32px', fontWeight: '700' }}>
              {stats.approved}
            </div>
          </div>

          <div style={{
            padding: '20px',
            background: 'rgba(255,0,0,0.1)',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '8px' }}>
              Skipped
            </div>
            <div style={{ color: '#ff6b6b', fontSize: '32px', fontWeight: '700' }}>
              {stats.rejected}
            </div>
          </div>

          <div style={{
            padding: '20px',
            background: 'rgba(0,245,255,0.1)',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '8px' }}>
              Total Earnings
            </div>
            <div style={{ color: '#00f5ff', fontSize: '32px', fontWeight: '700' }}>
              ${stats.earnings.toFixed(0)}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          {['all', 'pending', 'approved', 'rejected'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '10px 20px',
                background: filter === f ? 'rgba(255,0,110,0.3)' : 'rgba(255,255,255,0.05)',
                color: filter === f ? '#ff006e' : 'rgba(255,255,255,0.7)',
                border: filter === f ? '1px solid #ff006e' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {f} ({f === 'all' ? stats.total : 
                   f === 'pending' ? stats.pending :
                   f === 'approved' ? stats.approved : stats.rejected})
            </button>
          ))}
        </div>

        {/* Requests Table */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{
            overflowX: 'auto'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <th style={{ padding: '15px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: '600' }}>#</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: '600' }}>Song</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: '600' }}>Artist</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: '600' }}>Requester</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: '600' }}>Tier</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: '600' }}>Amount</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '15px', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: '600' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req, index) => {
                  const statusColor = 
                    req.request_status === 'approved' ? '#00ff88' :
                    req.request_status === 'rejected' ? '#ff6b6b' : '#FFD700';

                  return (
                    <tr key={req.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '15px', color: '#00f5ff', fontWeight: '600' }}>
                        {req.queue_position || (index + 1)}
                      </td>
                      <td style={{ padding: '15px', color: 'white', fontWeight: '600' }}>
                        {req.song}
                        {req.used_host_code && (
                          <span style={{
                            marginLeft: '8px',
                            padding: '2px 6px',
                            background: 'rgba(255,215,0,0.2)',
                            border: '1px solid #FFD700',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '600',
                            color: '#FFD700'
                          }}>
                            HOST
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '15px', color: 'rgba(255,255,255,0.7)' }}>
                        {req.artist}
                      </td>
                      <td style={{ padding: '15px', color: 'rgba(255,255,255,0.7)' }}>
                        {req.requester_name}
                      </td>
                      <td style={{ padding: '15px', color: 'rgba(255,255,255,0.7)' }}>
                        {req.tier_name}
                      </td>
                      <td style={{ padding: '15px', color: '#00f5ff', fontWeight: '600' }}>
                        ${(req.dj_price || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '15px' }}>
                        <span style={{
                          padding: '4px 10px',
                          background: `${statusColor}20`,
                          border: `1px solid ${statusColor}`,
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: statusColor,
                          textTransform: 'capitalize'
                        }}>
                          {req.request_status}
                        </span>
                      </td>
                      <td style={{ padding: '15px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                        {new Date(req.created_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredRequests.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'rgba(255,255,255,0.4)'
            }}>
              No requests found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
