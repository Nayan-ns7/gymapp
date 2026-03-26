import { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { db, auth } from './firebase';

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
  const [selectedUserMembers, setSelectedUserMembers] = useState<any[]>([]);
  const [currentTab, setCurrentTab] = useState('members'); // 'members', 'app-access'

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    
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
  }, [currentUser]);

  useEffect(() => {
    if (!selectedUser) {
      setSelectedUserMembers([]);
      return;
    }
    
    // Fetch members subcollection for the selected user
    const membersRef = collection(db, 'users', selectedUser.id, 'members');
    const unsubscribe = onSnapshot(membersRef, (snapshot: any) => {
      const membersData = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
      setSelectedUserMembers(membersData);
    }, (error: any) => {
      console.error("Error fetching sub-members:", error);
    });

    return () => unsubscribe();
  }, [selectedUser]);

  // Stats
  const totalUsers = users.length;
  const activeSubs = users.filter((u) => u.isSubscribed).length;

  // Filter & Search
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const name = (u.name || u.email || u.id || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const matchSearch = name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
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
        subscriptionEnd: Timestamp.fromDate(newEnd) 
      });
    } catch (e) {
      console.error("Error activating subscription:", e);
    }
  };

  const handleSetOnline = async (id: string) => {
    try {
      await updateDoc(doc(db, 'users', id), { isSubscribed: true });
    } catch (e) {
      console.error("Error setting online:", e);
    }
  };

  if (authLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>Loading application...</div>;
  }

  const ADMIN_UID = 'SbRsr50Sk5ViXx3IolsPiMCi9TI2';

  if (!currentUser || currentUser.uid !== ADMIN_UID) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        setLoginError('');
        const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        if (cred.user.uid !== ADMIN_UID) {
           await signOut(auth);
           setLoginError('Access Denied: You are not an authorized administrator.');
        }
      } catch (err: any) {
        setLoginError(err.message || 'Failed to log in');
      }
    };

    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: '20px' }}>
        <div className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '48px' }}>🛡️</span>
            <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '16px' }}>GymFit Admin</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Please log in to manage your gym.</p>
          </div>
          {loginError && (
            <div style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', fontSize: '14px', textAlign: 'center' }}>
              {loginError}
            </div>
          )}
          {currentUser && currentUser.uid !== ADMIN_UID && !loginError && (
            <div style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', fontSize: '14px', textAlign: 'center' }}>
              Access Denied: You are not authorized.
            </div>
          )}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <input 
                type="email" 
                placeholder="Admin Email" 
                value={loginEmail} 
                onChange={e => setLoginEmail(e.target.value)} 
                required
                className="search-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <input 
                type="password" 
                placeholder="Password" 
                value={loginPassword} 
                onChange={e => setLoginPassword(e.target.value)} 
                required
                className="search-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>Login to Dashboard</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span style={{fontSize: '28px'}}>🛡️</span>
          <span>GymFit Admin</span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <a href="#" className={`nav-link ${currentTab === 'members' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentTab('members'); }}>
            👥 Members
          </a>
          <a href="#" className={`nav-link ${currentTab === 'app-access' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setCurrentTab('app-access'); }}>
            🚫 Disable App
          </a>
          <a href="#" className="nav-link">
            📈 Analytics
          </a>
          <a href="#" className="nav-link">
            ⚙️ Settings
          </a>
          <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); signOut(auth); }} style={{ color: 'var(--danger)', marginTop: '24px' }}>
            🚪 Logout
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {currentTab === 'members' && (
          <>
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
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{user.name || user.email || user.id}</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{user.email || 'No email'}</div>
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
          </>
        )}

        {currentTab === 'app-access' && (
          <>
            <header className="header">
              <div>
                <h1 className="header-title">App Access Control</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Instantly lock or unlock app access for specific Firebase users.</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-outline" onClick={() => setFilter('all')} style={{ borderColor: filter === 'all' ? 'var(--accent-primary)' : '' }}>All</button>
                <button className="btn btn-outline" onClick={() => setFilter('active')} style={{ borderColor: filter === 'active' ? 'var(--accent-primary)' : '' }}>Online</button>
                <button className="btn btn-outline" onClick={() => setFilter('inactive')} style={{ borderColor: filter === 'inactive' ? 'var(--accent-primary)' : '' }}>Offline</button>
              </div>
            </header>
            
            <div className="data-table-container glass-panel">
              <div className="table-header">
                <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Firebase Authenticated Users</h2>
                <div className="search-box">
                  <span>🔍</span>
                  <input 
                    className="search-input" 
                    placeholder="Search accounts..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Account Info</th>
                      <th>App Status</th>
                      <th>Last Active</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                      <tr key={user.id} style={{ cursor: 'default' }}>
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{user.name || user.email || user.id}</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{user.email || 'No email'}</div>
                        </td>
                        <td>
                          {user.isSubscribed ? (
                            <span className="status-badge status-active">🟢 Online</span>
                          ) : (
                            <span className="status-badge status-inactive">🔴 Offline</span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {formatDateTime(user.lastActive)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {user.isSubscribed ? (
                            <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '14px' }} onClick={(e) => { e.stopPropagation(); handleStopSubscription(user.id); }}>
                              🔴 Set Offline
                            </button>
                          ) : (
                            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '14px' }} onClick={(e) => { e.stopPropagation(); handleSetOnline(user.id); }}>
                              🟢 Set Online
                            </button>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                          No Firebase users found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="user-avatar">{(selectedUser.name || selectedUser.email || '?').charAt(0)}</div>
                <h3 className="modal-title">{selectedUser.name || selectedUser.email || selectedUser.id}</h3>
                <p className="modal-subtitle">{selectedUser.email || 'No email'}</p>
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

            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '24px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Gym Members ({selectedUserMembers.length})</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
                {selectedUserMembers.length > 0 ? selectedUserMembers.map(member => (
                  <div key={member.id} className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ fontWeight: 500, fontSize: '14px' }}>{member.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{member.planName || 'No Plan'}</div>
                    <div style={{ fontSize: '11px', color: member.status === 'Active' ? 'var(--accent-primary)' : 'var(--danger)', marginTop: '4px', fontWeight: 600 }}>
                      {member.status || 'Unknown'}
                    </div>
                  </div>
                )) : (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                    No members found in this gym.
                  </div>
                )}
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
