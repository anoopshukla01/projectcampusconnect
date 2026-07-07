import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiData } from '../../hooks/useApiData';
import { StateContainer } from '../../components/StateContainer';
import './ELibrary.css';

const GENRES = ['all','cs','ece','maths','general'];

export default function ELibrary() {
  const { user } = useAuth();
  const showToast = useToast();
  const isProf = user?.role === 'professor';

  const { data: apiData, loading, error, isEmpty } = useApiData('/api/v1/community/elibrary', { resources: [] });

  const [genre, setGenre]   = useState('all');
  const [search, setSearch] = useState('');

  const books = useMemo(() => apiData?.resources || [], [apiData]);

  // Professor States
  const [requests, setRequests] = useState([]);

  const filtered = books.filter(b => {
    if (genre !== 'all' && (b.type || b.genre) !== genre) return false;
    if (search) { const q=search.toLowerCase(); return b.title.toLowerCase().includes(q)||(b.author && b.author.toLowerCase().includes(q)); }
    return true;
  });

  function handleBorrow(id) {
    const book = books.find(b=>b.id===id);
    if (book.status==='issued') return;
    if (book.status==='requested') {
      setBooks(p=>p.map(b=>b.id===id?{...b,status:'available'}:b));
      showToast('Borrow request cancelled.','info',2000);
    } else {
      setBooks(p=>p.map(b=>b.id===id?{...b,status:'requested'}:b));
      showToast(`Borrow request sent for "${book.title}"!`,'success',3000);
    }
  }

  function approveRequest(reqId, action) {
    const req = requests.find(r => r.id === reqId);
    setRequests(prev => prev.filter(r => r.id !== reqId));
    if (action === 'approve') {
      showToast(`Approved borrow request for "${req.title}"! 📖`, 'success', 3000);
    } else {
      showToast(`Declined borrow request for "${req.title}".`, 'info', 2000);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isProf ? 'E-Library Control Panel' : 'E-Library'}</h1>
          <p className="page-sub">
            {isProf
              ? `${requests.length} pending student borrow requests`
              : `Digital catalogue · ${books.filter(b=>b.status==='available').length} books available`}
          </p>
        </div>
      </div>

      {isProf && requests.length > 0 && (
        <section className="panel" style={{ marginBottom: '1.5rem' }}>
          <div className="panel-header">
            <h2 className="panel-title">Pending Student Borrow Requests</h2>
          </div>
          <div className="attend-table-wrap">
            <table className="attend-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll No</th>
                  <th>Requested Book</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id}>
                    <td className="subject-name-cell">{req.studentName}</td>
                    <td><code>{req.roll}</code></td>
                    <td><strong>{req.title}</strong></td>
                    <td>{req.date}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button className="action-btn" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => approveRequest(req.id, 'approve')}>
                          Approve
                        </button>
                        <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => approveRequest(req.id, 'decline')}>
                          Decline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="lib-controls">
        <div className="lib-search-wrap">
          <svg className="lib-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="lib-search" type="search" placeholder="Search by title, author or ISBN…" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search books"/>
        </div>
        <div className="filter-row">
          {GENRES.map(g=><button key={g} className={`filter-btn${genre===g?' active':''}`} onClick={()=>setGenre(g)}>{g==='all'?'All':g.toUpperCase()}</button>)}
        </div>
      </div>

      <StateContainer loading={loading} error={error} isEmpty={isEmpty} emptyMessage="No resources have been added to the library catalogue yet.">
        <div className="lib-grid" id="libraryGrid">
          {filtered.length ? filtered.map(book=>{
            const avail = book.status==='available', requested=book.status==='requested', issued=book.status==='issued';
            return (
              <div className="book-card" key={book.id}>
                <div className={`avail-indicator ${book.status || 'available'}`}>{avail?'Available':requested?'Requested':'Issued'}</div>
                <div className="book-cover" aria-hidden="true"><span>{book.title.slice(0,2).toUpperCase()}</span></div>
                <div className="book-info">
                  <h3 className="book-title">{book.title}</h3>
                  <p className="book-author">{book.author}</p>
                  <p className="book-year">{book.type || 'Resource'}</p>
                </div>
                {!isProf && (
                  <button className={`listing-btn${issued?' disabled':''}${requested?' requested':''}`} disabled={issued} onClick={()=>handleBorrow(book.id)}>
                    {issued?'Unavailable':requested?'Cancel Request':'Request Borrow'}
                  </button>
                )}
              </div>
            );
          }) : <div className="lib-empty">No matching resources found.</div>}
        </div>
      </StateContainer>
    </>
  );
}
