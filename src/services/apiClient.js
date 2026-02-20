import axios from 'axios';
import { API_URL } from '../config/config';
import { getAuthToken } from '../utils/session';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiMessage = error?.response?.data?.message;
    if (apiMessage) {
      error.message = apiMessage;
    }
    return Promise.reject(error);
  }
);

export default apiClient;
