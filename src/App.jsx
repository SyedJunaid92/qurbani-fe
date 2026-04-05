import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AddBooking from './pages/AddBooking.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import BookingsList from './pages/BookingsList.jsx';
import Login from './pages/Login.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<BookingsList />} />
          <Route path="/new" element={<AddBooking />} />
          <Route path="/bookings/:id" element={<BookingDetail />} />
          <Route path="/admin/users" element={<AdminUsers />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
