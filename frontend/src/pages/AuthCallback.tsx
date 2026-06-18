import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useToast } from '../context/ToastContext';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { fetchUser } = useAuthStore();
  const { addToast } = useToast();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;

    // OAuth tokens are delivered exclusively via an HttpOnly cookie set by the
    // backend on redirect — never in the URL. We only read non-secret status
    // flags here. (The old ?token= query path was removed: a token in the URL
    // leaks via Referer, history, and server logs.)
    const error = searchParams.get('error');
    const successMsg = searchParams.get('success');

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
  }, [searchParams, navigate, fetchUser, addToast]);

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
