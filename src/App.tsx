
import { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Removed static mock data in favor of Firestore real-time data.

function formatDate(date: any) {
  if (!date) return 'N/A';
  if (date.toDate) date = date.toDate();
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatDateTime(date: any) {
  if (!date) return 'N/A';
  if (date.toDate) date = date.toDate();
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }).format(date);
}

export default function App() {
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot: any) => {
      const usersData = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
      // Ensure selected modal updates if the user is open
      setSelectedUser((prev: any) => {
        if (!prev) return null;
        const updated = usersData.find((u: any) => u.id === prev.id);
        return updated || null;
      });
    }, (error: any) => {
      console.error("Error fetching users:", error);
    });

    return () => unsubscribe();
  }, []);

  // Stats
  const totalUsers = users.length;
  const activeSubs = users.filter((u) => u.isSubscribed).length;

  // Filter & Search
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFilter = filter === 'all' ? true : filter === 'active' ? u.isSubscribed : !u.isSubscribed;
      return matchSearch && matchFilter;
    });
  }, [users, searchTerm, filter]);

  const handleStopSubscription = async (id: string) => {
    try {
      await updateDoc(doc(db, 'users', id), { isSubscribed: false });
    } catch (e) {
      console.error("Error stopping subscription:", e);
    }
  };

  const handleActivateSubscription = async (id: string, months: number = 1) => {
    try {
      const newEnd = new Date();
      newEnd.setMonth(newEnd.getMonth() + months);
      await updateDoc(doc(db, 'users', id), { 
        isSubscribed: true, 
        subscriptionEnd: newEnd 
      });
    } catch (e) {
      console.error("Error activating subscription:", e);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span style={{fontSize: '28px'}}>🛡️</span>
          <span>GymFit Admin</span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <a href="#" className="nav-link active">
            👥 Members
          </a>
          <a href="#" className="nav-link">
            📈 Analytics
          </a>
          <a href="#" className="nav-link">
            ⚙️ Settings
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header">
          <div>
            <h1 className="header-title">Members Directory</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Manage your gym subscriptions and users in real-time.</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline" onClick={() => setFilter('all')} style={{ borderColor: filter === 'all' ? 'var(--accent-primary)' : '' }}>All</button>
            <button className="btn btn-outline" onClick={() => setFilter('active')} style={{ borderColor: filter === 'active' ? 'var(--accent-primary)' : '' }}>Active</button>
            <button className="btn btn-outline" onClick={() => setFilter('inactive')} style={{ borderColor: filter === 'inactive' ? 'var(--accent-primary)' : '' }}>Inactive</button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card glass-panel">
            <span className="stat-icon" style={{fontSize: '32px'}}>👥</span>
            <div className="stat-value">{totalUsers}</div>
            <div className="stat-label">Total Registered Users</div>
          </div>
          <div className="stat-card glass-panel" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <span className="stat-icon" style={{fontSize: '32px', opacity: 1}}>✅</span>
            <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>{activeSubs}</div>
            <div className="stat-label">Active Subscriptions</div>
          </div>
          <div className="stat-card glass-panel">
            <span className="stat-icon" style={{fontSize: '32px', opacity: 0.8}}>❌</span>
            <div className="stat-value">{totalUsers - activeSubs}</div>
            <div className="stat-label">Inactive Members</div>
          </div>
        </div>

        {/* Data Table */}
        <div className="data-table-container glass-panel">
          <div className="table-header">
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>User List</h2>
            <div className="search-box">
              <span>🔍</span>
              <input 
                className="search-input" 
                placeholder="Search by name or email..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th>Status</th>
                  <th>Subscription Ends</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                  <tr key={user.id} onClick={() => setSelectedUser(user)}>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{user.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{user.email}</div>
                    </td>
                    <td>
                      {user.isSubscribed ? (
                        <span className="status-badge status-active">✅ Active</span>
                      ) : (
                        <span className="status-badge status-inactive">❌ Expired</span>
                      )}
                    </td>
                    <td style={{ color: user.isSubscribed ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {formatDate(user.subscriptionEnd)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {formatDateTime(user.lastActive)}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                      No members found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="user-avatar">{selectedUser.name.charAt(0)}</div>
                <h3 className="modal-title">{selectedUser.name}</h3>
                <p className="modal-subtitle">{selectedUser.email}</p>
                <div style={{ marginTop: '12px' }}>
                  {selectedUser.isSubscribed ? (
                        <span className="status-badge status-active">✅ Active Subscription</span>
                      ) : (
                        <span className="status-badge status-inactive">❌ Subscription Inactive</span>
                  )}
                </div>
              </div>
              <button className="close-btn" onClick={() => setSelectedUser(null)} style={{fontSize: '24px', lineHeight: '1', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)'}}>
                ✕
              </button>
            </div>

            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">📅 Member Since</span>
                <span className="info-value">{formatDate(selectedUser.createdAt)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">⏱️ Last Active</span>
                <span className="info-value">{formatDateTime(selectedUser.lastActive)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Subscription Ends</span>
                <span className="info-value" style={{ color: selectedUser.isSubscribed ? 'var(--text-primary)' : 'var(--danger)' }}>
                  {formatDate(selectedUser.subscriptionEnd)}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Total Usage Days</span>
                <span className="info-value">{selectedUser.totalUsageDays} days</span>
              </div>
            </div>

            <div className="modal-actions">
              {selectedUser.isSubscribed ? (
                <button className="btn btn-danger" onClick={() => handleStopSubscription(selectedUser.id)}>
                  ❌ Stop Subscription
                </button>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={() => handleActivateSubscription(selectedUser.id, 1)}>
                    ✅ Activate (1 Month)
                  </button>
                  <button className="btn btn-primary" style={{ background: '#3b82f6', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)' }} onClick={() => handleActivateSubscription(selectedUser.id, 12)}>
                    ✅ Activate (1 Year)
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
