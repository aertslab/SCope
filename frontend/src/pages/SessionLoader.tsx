import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSession } from '../api/sessions'

export default function SessionLoader() {
    const { sessionId } = useParams()
    const navigate = useNavigate()
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const loadSession = async () => {
            if (!sessionId) return
            try {
                const session = await getSession(sessionId)
                
                if (session.data?.type === 'workspace') {
                    navigate('/viewer', { 
                        state: { sessionData: session.data },
                        replace: true 
                    })
                    return
                }

                if (session.data && session.data.datasetId) {
                    navigate(`/viewer/${session.data.datasetId}`, { 
                        state: { sessionData: session.data },
                        replace: true 
                    })
                } else {
                    console.error("Session data missing datasetId", session.data);
                    setError("Invalid session data")
                }
            } catch (err) {
                console.error(err)
                setError("Failed to load session")
            }
        }
        loadSession()
    }, [sessionId, navigate])

    if (error) return <div className="h-full w-full bg-black flex items-center justify-center text-red-500">{error}</div>

    return <div className="h-full w-full bg-black flex items-center justify-center text-white">Loading session...</div>
}
