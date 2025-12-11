import api from './client'

export interface SessionData {
    id: string
    data: any
    created_at: string
}

export const createSession = async (data: any): Promise<SessionData> => {
    const response = await api.post('/sessions/', { data })
    return response.data
}

export const getSession = async (id: string): Promise<SessionData> => {
    const response = await api.get(`/sessions/${id}`)
    return response.data
}
