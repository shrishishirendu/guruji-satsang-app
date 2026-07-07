import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children }) {
  const { currentUser } = useAuth();
  const location = useLocation();
  // Signed in → show the page. Not signed in → send to the Welcome/home page
  // (friendlier for a brand-new invitee than the bare login form), remembering
  // where they were headed so sign-in/registration can return them there.
  return currentUser
    ? children
    : <Navigate to="/" replace state={{ from: location.pathname + location.search }} />;
}
