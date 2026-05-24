import axios from 'axios'

const api = axios.create({
    baseURL: 'http://localhost:8080'
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if(token){
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

export const getApiErrorMessage = (error, fallbackMessage = 'Something went wrong. Please try again.') => {
    const responseData = error?.response?.data

    if (typeof responseData === 'string' && responseData.trim()) {
        return responseData
    }

    if (responseData?.message) {
        return responseData.message
    }

    if (responseData?.error) {
        return responseData.error
    }

    return fallbackMessage
}

export const isForbiddenError = (error) => error?.response?.status === 403
export const isUnauthorizedError = (error) => error?.response?.status === 401


export default api
