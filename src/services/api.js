import axios from 'axios';

const API_BASE = '/api';

// Create axios instance with auth header
const apiClient = axios.create({
  baseURL: API_BASE,
});

// Add auth token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API functions
export const api = {
  // Auth
  login: (username, password) => 
    axios.post(`${API_BASE}/login`, { username, password }),

  // Trucks
  getTrucks: () => apiClient.get('/trucks'),
  createTruck: (truck) => apiClient.post('/trucks', truck),
  updateTruck: (id, truck) => apiClient.put(`/trucks/${id}`, truck),
  deleteTruck: (id) => apiClient.delete(`/trucks/${id}`),

  // Trips
  getTrips: () => apiClient.get('/trips'),
  createTrip: (trip) => apiClient.post('/trips', trip),
  updateTrip: (id, trip) => apiClient.put(`/trips/${id}`, trip),
  deleteTrip: (id) => apiClient.delete(`/trips/${id}`),

  // Users
  getUsers: () => apiClient.get('/users'),
  createUser: (user) => apiClient.post('/users', user),
  updateUser: (id, user) => apiClient.put(`/users/${id}`, user),
  deleteUser: (id) => apiClient.delete(`/users/${id}`),

  // Drivers
  getDrivers: () => apiClient.get('/drivers'),
  createDriver: (driver) => apiClient.post('/drivers', driver),
  updateDriver: (id, driver) => apiClient.put(`/drivers/${id}`, driver),
  deleteDriver: (id) => apiClient.delete(`/drivers/${id}`),

  assignDriverTruck: (driverId, truck_number) => apiClient.put(`/drivers/${driverId}/truck`, { truck_number }),

  // Driver Documents
  getDriverDocuments: (driverId) => apiClient.get(`/driver-documents/${driverId}`),
  createDriverDocument: (doc) => apiClient.post('/driver-documents', doc),
  updateDriverDocument: (id, doc) => apiClient.put(`/driver-documents/${id}`, doc),
  deleteDriverDocument: (id) => apiClient.delete(`/driver-documents/${id}`),

  // Logs
  getLogs: () => apiClient.get('/logs'),
};