import axios from "axios";

// In dev the Vite proxy forwards /api → localhost:8000, so no absolute URL needed.
// In production (Vercel) we need the full Render backend URL.
const BASE = import.meta.env.VITE_API_URL ?? "";

const client = axios.create({
  baseURL: BASE,
  withCredentials: true,  // send session cookie cross-origin
});

export default client;
