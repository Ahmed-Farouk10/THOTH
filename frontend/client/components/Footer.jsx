import { Link } from 'react-router-dom';
import { Github, Twitter, Linkedin, Mail, Sparkles } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { label: 'Features', href: '/#features' },
      { label: 'Oracle', href: '/oracle' },
      { label: 'Temple', href: '/temple' },
      { label: 'Pricing', href: '/#pricing' },
    ],
    resources: [
      { label: 'Documentation', href: '/docs' },
      { label: 'API Reference', href: '/api' },
      { label: 'Guides', href: '/guides' },
      { label: 'Support', href: '/support' },
    ],
    company: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '/contact' },
    ],
    legal: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Security', href: '/security' },
      { label: 'Compliance', href: '/compliance' },
    ],
  };

  const socialLinks = [
    { icon: Github, href: '#', label: 'GitHub' },
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' },
    { icon: Mail, href: '#', label: 'Email' },
  ];

  return (
    <footer className="bg-bg-void border-t border-gold-primary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-gold-primary to-gold-dark rounded-full flex items-center justify-center text-2xl shadow-gold">
                <Sparkles className="w-6 h-6 text-bg-void" />
              </div>
              <div>
                <span className="text-2xl font-bold text-gradient-gold" style={{
                  fontFamily: 'Cinzel, serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}>THOTH</span>
                <p className="text-xs text-text-muted uppercase tracking-widest" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Intelligence Platform
                </p>
              </div>
            </Link>
            <p className="text-text-secondary mb-6 max-w-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Where ancient wisdom meets modern AI. Experience the power of knowledge
              through our enterprise cloud-based learning platform.
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-bg-obsidian border border-gold-primary/20 text-text-secondary hover:text-gold-primary hover:border-gold-primary transition-all duration-300 card-obsidian"
                    aria-label={social.label}
                  >
                    <Icon size={18} />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Links Columns */}
          <div>
            <h3 className="text-sm font-semibold text-gold-primary uppercase tracking-wider mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
              Product
            </h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-text-secondary hover:text-gold-primary transition-colors duration-200 text-sm"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gold-primary uppercase tracking-wider mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
              Resources
            </h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-text-secondary hover:text-gold-primary transition-colors duration-200 text-sm"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gold-primary uppercase tracking-wider mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
              Company
            </h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-text-secondary hover:text-gold-primary transition-colors duration-200 text-sm"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gold-primary uppercase tracking-wider mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
              Legal
            </h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-text-secondary hover:text-gold-primary transition-colors duration-200 text-sm"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gold-primary/20 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-text-muted text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
            &copy; {currentYear} Thoth Intelligence Platform. All rights reserved.
          </p>
          <p className="text-text-muted text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
            Built with <span className="text-gold-primary">✨</span> for knowledge seekers
          </p>
        </div>
      </div>
    </footer>
  );
}
