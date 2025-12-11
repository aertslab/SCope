import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useToast } from '../context/ToastContext';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setToken } = useAuthStore();
  const { addToast } = useToast();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    const successMsg = searchParams.get('success');

    if (token) {
      processedRef.current = true;
      setToken(token)
        .then((success: boolean) => {
          if (success) {
            addToast('Successfully logged in', 'success');
            navigate('/dashboard');
          } else {
            addToast('Failed to verify session', 'error');
            navigate('/login');
          }
        })
        .catch((err: any) => {
          console.error('Failed to fetch user details', err);
          addToast('Failed to complete login', 'error');
          navigate('/login');
        });
    } else if (successMsg === 'orcid_linked') {
      processedRef.current = true;
      addToast('ORCiD account successfully linked', 'success');
      navigate('/profile');
    } else if (error) {
      processedRef.current = true;
      if (error === 'no_orcid_link') {
        addToast('No account linked to this ORCiD. Please login and link it from your profile.', 'error');
      } else if (error === 'orcid_already_linked') {
        addToast('This ORCiD is already linked to another account.', 'error');
      } else {
        addToast(`Login failed: ${error}`, 'error');
      }
      navigate('/login');
    }
  }, [searchParams, navigate, setToken, addToast]);

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
