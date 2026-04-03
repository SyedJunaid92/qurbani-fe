import { Link, Route, Routes } from 'react-router-dom';
import AddBooking from './pages/AddBooking.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import BookingsList from './pages/BookingsList.jsx';

export default function App() {
  return (
    <div className="layout">
      <header>
        <h1>Qurbani bookings</h1>
        <nav className="nav-links">
          <Link to="/">All bookings</Link>
          <Link to="/new">Add booking</Link>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<BookingsList />} />
        <Route path="/new" element={<AddBooking />} />
        <Route path="/bookings/:id" element={<BookingDetail />} />
      </Routes>
    </div>
  );
}
