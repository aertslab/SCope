import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useToast } from '../context/ToastContext';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setToken, fetchUser } = useAuthStore();
  const { addToast } = useToast();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;

    // Legacy support: if the backend (or a CLI) still passes a token in the
    // URL, accept it once and then clean the address bar. New backend versions
    // set an HttpOnly cookie instead and never expose the token in the URL.
    const legacyToken = searchParams.get('token');
    const error = searchParams.get('error');
    const successMsg = searchParams.get('success');

    const cleanUrl = () => {
      try { window.history.replaceState({}, document.title, window.location.pathname); } catch { /* ignore */ }
    };

    if (legacyToken) {
      processedRef.current = true;
      cleanUrl();
      setToken(legacyToken)
        .then((ok: boolean) => {
          if (ok) { addToast('Successfully logged in', 'success'); navigate('/dashboard'); }
          else   { addToast('Failed to verify session', 'error'); navigate('/login'); }
        })
        .catch(() => { addToast('Failed to complete login', 'error'); navigate('/login'); });
      return;
    }

    if (successMsg === 'orcid_linked') {
      processedRef.current = true;
      addToast('ORCiD account successfully linked', 'success');
      navigate('/profile');
      return;
    }

    if (error) {
      processedRef.current = true;
      if (error === 'no_orcid_link') {
        addToast('No account linked to this ORCiD. Please login and link it from your profile.', 'error');
      } else if (error === 'orcid_already_linked') {
        addToast('This ORCiD is already linked to another account.', 'error');
      } else {
        addToast(`Login failed: ${error}`, 'error');
      }
      navigate('/login');
      return;
    }

    // Default path: cookie-based OAuth handshake. The backend has already set
    // the auth cookie on the redirect; verify the session by fetching /me.
    processedRef.current = true;
    fetchUser()
      .then((ok: boolean) => {
        if (ok) { addToast('Successfully logged in', 'success'); navigate('/dashboard'); }
        else   { addToast('Failed to verify session', 'error'); navigate('/login'); }
      })
      .catch(() => { addToast('Failed to complete login', 'error'); navigate('/login'); });
  }, [searchParams, navigate, setToken, fetchUser, addToast]);

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Processing login...
        </h2>
      </div>
    </div>
  );
}
