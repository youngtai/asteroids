import { RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import { router } from './router.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<RouterProvider router={router} />);
