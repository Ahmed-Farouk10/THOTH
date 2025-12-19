import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen py-20 bg-gradient-to-b from-stone-dark to-stone-medium flex items-center justify-center">
      <div className="max-w-md mx-auto px-5 text-center">
        <h1 className="text-8xl font-bold text-gold-light mb-4">404</h1>
        <h2 className="text-4xl font-bold text-papyrus-light mb-4">Lost in the Temple</h2>
        <p className="text-xl text-papyrus-dark mb-8">
          The path you seek does not exist within Thoth's sacred halls. Return to the light and seek guidance from the oracle.
        </p>
        <Link
          to="/"
          className="btn btn-primary inline-flex items-center gap-2 text-lg px-8 py-4"
        >
          <Home size={24} />
          Return to Temple
        </Link>
      </div>
    </div>
  );
}
