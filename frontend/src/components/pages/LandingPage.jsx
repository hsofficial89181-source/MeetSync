import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Github, Linkedin, Menu, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { navItems } from '../landing/LandingData';
import {
  CollaborationSection, FeatureSection, HeroSection, IntegrationsSection,
  ProofStrip, ValueSection, WorkflowSection,
} from '../landing/ProductSections';
import {
  FaqSection, FinalCtaSection, PricingSection, SocialProofSection,
} from '../landing/ConversionSections';
import './LandingPage.css';

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const navRef = useRef(null);

  useEffect(() => {
    document.body.classList.add('landing-active');
    const revealElements = Array.from(document.querySelectorAll('[data-reveal]'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      revealElements.forEach(element => element.classList.add('is-visible'));
    } else {
      const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      revealElements.forEach(element => revealObserver.observe(element));
      return () => {
        revealObserver.disconnect();
        document.body.classList.remove('landing-active');
      };
    }

    return () => document.body.classList.remove('landing-active');
  }, []);

  useEffect(() => {
    let frame = 0;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const parallaxElements = Array.from(document.querySelectorAll('[data-parallax]'));

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(y > 18);
      setProgress(max > 0 ? Math.min(100, (y / max) * 100) : 0);
      if (!reduceMotion && window.innerWidth > 768) {
        parallaxElements.forEach(element => {
          const speed = Number(element.dataset.parallax || 0);
          element.style.transform = `translate3d(0, ${y * speed}px, 0)`;
        });
      }
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const sectionIds = ['home', 'product', 'workflow', 'integrations', 'pricing', 'faq'];
    const sections = sectionIds.map(id => document.getElementById(id)).filter(Boolean);
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: '-28% 0px -58% 0px', threshold: [0, 0.15, 0.4] });
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    const onPointerDown = event => {
      if (mobileOpen && navRef.current && !navRef.current.contains(event.target)) setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  return <div className="landing-page">
    <div className="lp-page-progress" style={{ transform: `scaleX(${progress / 100})` }} />
    <header className={`lp-header ${scrolled ? 'is-scrolled' : ''}`} ref={navRef}>
      <div className="lp-container lp-nav-wrap">
        <a href="#home" className="lp-brand" onClick={closeMobile} aria-label="MeetSync AI home"><span><Sparkles size={18} /></span><b>MeetSync</b><small>AI</small></a>
        <nav className={`lp-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <div className="lp-mobile-nav-head"><a href="#home" className="lp-brand" onClick={closeMobile}><span><Sparkles size={17} /></span><b>MeetSync</b><small>AI</small></a><button type="button" onClick={closeMobile} aria-label="Close navigation"><X size={21} /></button></div>
          <div className="lp-nav-links">{navItems.map(item => <a key={item.href} href={item.href} onClick={closeMobile} aria-current={activeSection === item.href.slice(1) ? 'page' : undefined}>{item.label}</a>)}</div>
          <div className="lp-mobile-actions"><Link className="lp-button lp-button-secondary" to="/login">Login</Link><Link className="lp-button lp-button-primary" to="/register">Get started <ArrowRight size={15} /></Link></div>
        </nav>
        <div className="lp-nav-actions"><Link className="lp-login-link" to="/login">Login</Link><Link className="lp-button lp-button-primary lp-nav-cta" to="/register">Get started <ArrowRight size={14} /></Link><button type="button" className="lp-menu-button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={21} /></button></div>
      </div>
    </header>
    {mobileOpen && <div className="lp-nav-backdrop" />}

    <main>
      <HeroSection />
      <ProofStrip />
      <ValueSection />
      <FeatureSection />
      <WorkflowSection />
      <CollaborationSection />
      <IntegrationsSection />
      <PricingSection />
      <SocialProofSection />
      <FaqSection />
      <FinalCtaSection />
    </main>

    <footer className="lp-footer"><div className="lp-container">
      <div className="lp-footer-main"><div className="lp-footer-brand"><a href="#home" className="lp-brand"><span><Sparkles size={18} /></span><b>MeetSync</b><small>AI</small></a><p>Turn meeting conversations into organized, assigned, and synchronized work.</p><div className="lp-social-links"><a href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn"><Linkedin size={17} /></a><a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub"><Github size={17} /></a></div></div>
        <div className="lp-footer-links"><div><b>Product</b><a href="#product">Features</a><a href="#workflow">How it works</a><a href="#integrations">Integrations</a><a href="#pricing">Pricing</a></div><div><b>Workspace</b><Link to="/register">Get started</Link><Link to="/login">Login</Link><a href="#faq">FAQ</a></div><div><b>Legal</b><Link to="/privacy-policy">Privacy policy</Link><Link to="/terms-conditions">Terms & conditions</Link></div></div>
      </div>
      <div className="lp-footer-bottom"><span>© {new Date().getFullYear()} MeetSync AI. Built for teams that move.</span><span className="lp-system-status"><i /> All systems operational</span></div>
    </div></footer>
  </div>;
}
