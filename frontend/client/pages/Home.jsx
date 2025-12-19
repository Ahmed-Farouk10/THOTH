import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Volume2, 
  Mic, 
  FileText, 
  Brain, 
  ArrowRight, 
  Sparkles,
  Zap,
  Shield,
  Cloud,
  ChevronRight
} from 'lucide-react';

const features = [
  {
    icon: Volume2,
    title: 'Text-to-Speech',
    description: 'Transform written knowledge into spoken wisdom with advanced AI-powered voice synthesis.',
    link: '/tts',
    gradient: 'from-gold-primary to-gold-light',
  },
  {
    icon: Mic,
    title: 'Speech-to-Text',
    description: 'Convert spoken words into written text with precision and accuracy using cutting-edge transcription.',
    link: '/stt',
    gradient: 'from-gold-light to-amber',
  },
  {
    icon: FileText,
    title: 'Document Reader',
    description: 'Intelligently process and extract insights from documents, PDFs, and various file formats.',
    link: '/documents',
    gradient: 'from-gold-primary to-gold-dark',
  },
  {
    icon: Brain,
    title: 'AI Quiz Generator',
    description: 'Generate intelligent quizzes and assessments from your content using advanced AI algorithms.',
    link: '/quiz',
    gradient: 'from-amber to-gold-primary',
  },
];

const capabilities = [
  { icon: Zap, text: 'Lightning Fast Processing' },
  { icon: Shield, text: 'Enterprise-Grade Security' },
  { icon: Cloud, text: 'Scalable Cloud Infrastructure' },
  { icon: Sparkles, text: 'AI-Powered Intelligence' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-bg-void">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background - Void Black with subtle gradient */}
        <div className="absolute inset-0 bg-bg-void" />
        <div className="absolute inset-0 bg-gradient-radial from-bg-obsidian/50 via-transparent to-transparent" style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(26, 26, 26, 0.5) 0%, transparent 70%)'
        }} />
        
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-gold-primary/5 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-gold-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold-primary/10 border border-gold-primary/30 text-gold-primary text-sm font-medium mb-8 card-obsidian"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Sparkles className="w-4 h-4" />
              <span>Enterprise AI Learning Platform</span>
            </motion.div>

            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6 text-gradient-gold text-shadow-gold leading-tight" style={{
              fontFamily: 'Cinzel, serif',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              Welcome to Thoth
            </h1>

            <p className="text-xl md:text-2xl text-text-secondary max-w-3xl mx-auto mb-4 leading-relaxed" style={{
              fontFamily: 'Inter, sans-serif',
            }}>
              Where Ancient Wisdom Meets
            </p>
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gradient-gold mb-12" style={{
              fontFamily: 'Cinzel, serif',
            }}>
              Modern Artificial Intelligence
            </p>

            <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed" style={{
              fontFamily: 'Inter, sans-serif',
            }}>
              Experience the power of knowledge through our cloud-based learning platform.
              Transform how you learn, teach, and interact with information.
            </p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <Link to="/oracle" className="btn btn-primary text-lg px-8 py-4 group">
                Consult the Oracle
                <ArrowRight className="inline-block ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button className="btn btn-secondary text-lg px-8 py-4">
                Explore Features
              </button>
            </motion.div>

            {/* Capabilities */}
            <motion.div
              className="flex flex-wrap items-center justify-center gap-8 text-text-secondary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              {capabilities.map((cap, index) => {
                const Icon = cap.icon;
                return (
                  <div key={index} className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-gold-primary" />
                    <span className="text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>{cap.text}</span>
                  </div>
                );
              })}
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
        >
          <div className="flex flex-col items-center gap-2 text-text-secondary">
            <span className="text-xs uppercase tracking-wider" style={{ fontFamily: 'Inter, sans-serif' }}>Scroll to explore</span>
            <motion.div
              className="w-6 h-10 border-2 border-gold-primary/30 rounded-full flex justify-center"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <div className="w-1.5 h-1.5 bg-gold-primary rounded-full mt-2" />
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="section bg-bg-void relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23D4AF37' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="section-title">
            <h2 style={{
              fontFamily: 'Cinzel, serif',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
            }}>Platform Capabilities</h2>
            <p style={{ fontFamily: 'Inter, sans-serif' }}>
              Discover the powerful features that make Thoth the ultimate AI learning platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <Link to={feature.link} className="feature-card group block h-full">
                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 mx-auto shadow-gold`}>
                      <Icon className="w-8 h-8 text-bg-void" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4" style={{
                      fontFamily: 'Cinzel, serif',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>{feature.title}</h3>
                    <p className="text-text-secondary leading-relaxed mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {feature.description}
                    </p>
                    <div className="flex items-center text-gold-primary font-medium group-hover:gap-2 transition-all" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Learn more
                      <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section bg-bg-void relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gold-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6 text-gradient-gold" style={{
              fontFamily: 'Cinzel, serif',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              Ready to Begin Your Journey?
            </h2>
            <p className="text-xl text-text-secondary mb-12 max-w-2xl mx-auto leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Join thousands of learners and educators who are transforming education
              with the power of AI.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/oracle" className="btn btn-primary text-lg px-8 py-4">
                Get Started Free
              </Link>
              <Link to="/temple" className="btn btn-secondary text-lg px-8 py-4">
                Explore Temple
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
