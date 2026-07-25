import React, { useState } from 'react';
import { ArrowRight, Check, ChevronDown, Sparkles, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { faqs, planCatalog } from './LandingData';
import { Reveal, SectionHeading } from './ProductSections';

export function PricingSection() {
  const [interval, setInterval] = useState('monthly');
  const yearly = interval === 'yearly';

  return <section className="lp-section lp-pricing-section" id="pricing"><div className="lp-container">
    <Reveal><SectionHeading eyebrow="Pricing that scales with momentum" title={<>Choose the capacity.<br /><span>Keep every capability.</span></>} text="Every plan includes the core meeting-to-execution workflow. Start with seven days to experience it in your own workspace." /></Reveal>
    <Reveal className="lp-pricing-toggle" delay={80}><button type="button" className={!yearly ? 'active' : ''} onClick={() => setInterval('monthly')}>Monthly</button><button type="button" className={yearly ? 'active' : ''} onClick={() => setInterval('yearly')}>Yearly <span>Save more</span></button></Reveal>
    <div className="lp-pricing-grid">
      {planCatalog.map((plan, i) => <Reveal className={`lp-plan-card ${plan.featured ? 'is-featured' : ''}`} delay={i * 70} key={plan.name}>
        {plan.featured && <div className="lp-popular-label"><Star size={12} fill="currentColor" /> Most popular</div>}
        <div className="lp-plan-top"><span>{plan.name}</span><p>{plan.description}</p></div>
        <div className="lp-plan-price"><sup>$</sup><strong>{yearly ? plan.yearly.toLocaleString() : plan.monthly.toLocaleString()}</strong><span>/{yearly ? 'yr' : 'mo'}</span></div>
        <div className="lp-plan-usage">{yearly ? plan.yearlyHours : plan.monthlyHours} meeting hours / {yearly ? 'year' : 'month'}</div>
        <Link className={`lp-button ${plan.featured ? 'lp-button-primary' : 'lp-button-secondary'}`} to="/register">Start free trial <ArrowRight size={15} /></Link>
        <ul>{plan.features.map(item => <li key={item}><Check size={14} />{item}</li>)}</ul>
      </Reveal>)}
    </div>
    <p className="lp-pricing-footnote">All prices are in USD. Billing is managed securely after workspace creation.</p>
  </div></section>;
}

export function SocialProofSection() {
  return <section className="lp-section lp-social-section"><div className="lp-container">
    <Reveal><div className="lp-quote-card"><div className="lp-quote-stars">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={15} fill="currentColor" />)}</div><blockquote>“The most valuable meeting note is the one your team never has to rewrite. MeetSync is designed around that idea—from transcript to ownership to execution.”</blockquote><div className="lp-quote-attribution"><span><Sparkles size={17} /></span><div><b>Built into the product workflow</b><small>Context preserved at every handoff</small></div></div></div></Reveal>
    <div className="lp-trust-grid"><Reveal delay={60}><b>Visible ownership</b><span>Every matched action item has a clear home.</span></Reveal><Reveal delay={120}><b>Traceable context</b><span>Tasks stay connected to the meeting that created them.</span></Reveal><Reveal delay={180}><b>Measurable execution</b><span>Completion, workload, and overdue trends stay in view.</span></Reveal><Reveal delay={240}><b>Flexible handoffs</b><span>Share, export, reassign, and sync without losing momentum.</span></Reveal></div>
  </div></section>;
}

export function FaqSection() {
  const [open, setOpen] = useState(0);
  return <section className="lp-section lp-faq-section" id="faq"><div className="lp-container lp-faq-layout">
    <Reveal className="lp-faq-intro"><SectionHeading align="left" eyebrow="Frequently asked" title={<>Everything you need<br /><span>before your first upload.</span></>} text="A practical overview of how MeetSync fits into your team’s workflow." /><Link className="lp-text-link" to="/register">Try it with your team <ArrowRight size={15} /></Link></Reveal>
    <div className="lp-faq-list">{faqs.map((item, index) => { const isOpen = open === index; return <Reveal delay={(index % 3) * 50} key={item.q}><div className={`lp-faq-item ${isOpen ? 'is-open' : ''}`}><button type="button" aria-expanded={isOpen} aria-controls={`faq-panel-${index}`} onClick={() => setOpen(isOpen ? -1 : index)}><span>{item.q}</span><ChevronDown size={18} /></button><div id={`faq-panel-${index}`} className="lp-faq-answer" role="region"><div><p>{item.a}</p></div></div></div></Reveal>; })}</div>
  </div></section>;
}

export function FinalCtaSection() {
  return <section className="lp-final-cta"><div className="lp-container"><Reveal variant="scale"><div className="lp-final-card"><div className="lp-final-grid" aria-hidden="true" /><div className="lp-final-glow" /><span className="lp-eyebrow"><Sparkles size={13} /> Your next meeting can move faster</span><h2>Make every conversation<br /><span>count twice.</span></h2><p>Once for the ideas. Again for the work they create.</p><div className="lp-final-actions"><Link className="lp-button lp-button-primary lp-button-large" to="/register">Start your 7-day trial <ArrowRight size={17} /></Link><Link className="lp-button lp-button-glass lp-button-large" to="/login">Sign in</Link></div></div></Reveal></div></section>;
}
