import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD28rhJ4BlqfpYN14bE8Vw_6U_P0tmW_aI",
  authDomain: "campus-connect-4b5ca.firebaseapp.com",
  projectId: "campus-connect-4b5ca",
  storageBucket: "campus-connect-4b5ca.firebasestorage.app",
  messagingSenderId: "65702096261",
  appId: "1:65702096261:web:4a3a1bedc4ae7e97eea8ec",
  measurementId: "G-NZ63MZRYLT"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
