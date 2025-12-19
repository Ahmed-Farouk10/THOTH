import { Link } from 'react-router-dom';
import { Home, Compass } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-screen py-20 bg-gradient-to-b from-thoth-navy via-thoth-deep-blue to-thoth-navy flex items-center justify-center relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-thoth-gold/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-thoth-accent-blue/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <motion.div
        className="max-w-md mx-auto px-5 text-center relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="mb-8"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Compass className="w-32 h-32 mx-auto text-thoth-gold/50" />
        </motion.div>

        <h1 className="text-9xl font-bold text-gradient mb-4 text-shadow-gold">404</h1>
        <h2 className="text-4xl font-bold text-thoth-sand mb-4">Lost in the Temple</h2>
        <p className="text-xl text-thoth-stone mb-8 leading-relaxed">
          The path you seek does not exist within Thoth's sacred halls. 
          Return to the light and seek guidance from the oracle.
        </p>
        <Link
          to="/"
          className="btn btn-primary inline-flex items-center gap-2 text-lg px-8 py-4"
        >
          <Home className="w-5 h-5" />
          Return Home
        </Link>
      </motion.div>
    </div>
  );
}

