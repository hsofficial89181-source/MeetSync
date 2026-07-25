import React from 'react';
import { ArrowRight, Check, ChevronRight, Play, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { features, integrationItems, proofItems, valueCards, workflowSteps } from './LandingData';
import { CollaborationVisual, HeroDashboard, WorkflowVisual } from './ProductVisuals';

export function Reveal({ children, className = '', delay = 0, variant = 'up' }) {
  return <div className={`lp-reveal lp-reveal-${variant} ${className}`} data-reveal style={{ '--reveal-delay': `${delay}ms` }}>{children}</div>;
}

export function SectionHeading({ eyebrow, title, text, align = 'center' }) {
  return <div className={`lp-section-heading lp-align-${align}`}>
    <span className="lp-eyebrow"><Sparkles size={13} />{eyebrow}</span>
    <h2>{title}</h2>
    {text && <p>{text}</p>}
  </div>;
}

export function HeroSection() {
  return <section className="lp-hero" id="home">
    <div className="lp-hero-grid" aria-hidden="true" />
    <div className="lp-orb lp-orb-one" data-parallax="0.1" />
    <div className="lp-orb lp-orb-two" data-parallax="-0.07" />
    <div className="lp-container lp-hero-content">
      <Reveal className="lp-hero-copy">
        <span className="lp-announcement"><i><Sparkles size={12} /></i> Turn every conversation into forward motion <ChevronRight size={13} /></span>
        <h1>Meetings become<br /><span>work that gets done.</span></h1>
        <p>MeetSync AI transforms recordings into accurate transcripts, clear decisions, assigned tasks, and synchronized workflows—before your team loses momentum.</p>
        <div className="lp-hero-actions">
          <Link className="lp-button lp-button-primary lp-button-large" to="/register">Start your 7-day trial <ArrowRight size={17} /></Link>
          <a className="lp-button lp-button-secondary lp-button-large" href="#workflow"><Play size={15} fill="currentColor" /> See how it works</a>
        </div>
        <div className="lp-hero-trust"><span><Check size={13} /> No setup fee</span><span><Check size={13} /> Workspace ready in minutes</span><span><Check size={13} /> Cancel anytime</span></div>
      </Reveal>
      <Reveal className="lp-hero-visual" delay={180} variant="scale"><HeroDashboard /></Reveal>
    </div>
    <div className="lp-scroll-cue" aria-hidden="true"><span>Explore</span><i /></div>
  </section>;
}

export function ProofStrip() {
  return <section className="lp-proof" aria-label="Product highlights"><div className="lp-container lp-proof-inner">
    <p>Designed to preserve context from the first word to the final task.</p>
    <div className="lp-proof-items">{proofItems.map(({ icon: Icon, value, label }, i) => <Reveal className="lp-proof-item" delay={i * 70} key={value}><Icon size={18} /><div><b>{value}</b><span>{label}</span></div></Reveal>)}</div>
  </div></section>;
}

export function ValueSection() {
  return <section className="lp-section lp-value-section" id="product"><div className="lp-container">
    <Reveal><SectionHeading eyebrow="From talk to traction" title={<>The meeting ends.<br /><span>The work begins automatically.</span></>} text="MeetSync closes the distance between a useful conversation and accountable execution." /></Reveal>
    <div className="lp-value-grid">{valueCards.map(({ icon: Icon, eyebrow, title, text, accent }, i) => <Reveal className={`lp-value-card lp-card-accent-${accent}`} delay={i * 90} key={title}><div className="lp-card-icon"><Icon size={22} /></div><small>{eyebrow}</small><h3>{title}</h3><p>{text}</p><div className="lp-card-line" /></Reveal>)}</div>
  </div></section>;
}

export function FeatureSection() {
  return <section className="lp-section lp-feature-section"><div className="lp-container">
    <Reveal><SectionHeading eyebrow="Everything stays connected" title={<>Meeting intelligence,<br /><span>built for execution.</span></>} text="A complete workflow for capturing context, organizing responsibility, and helping teams finish what they start." /></Reveal>
    <div className="lp-feature-grid">{features.map(({ icon: Icon, title, text }, i) => <Reveal className="lp-feature-card" delay={(i % 3) * 70} key={title}><div className="lp-feature-icon"><Icon size={19} /></div><h3>{title}</h3><p>{text}</p><span className="lp-feature-index">{String(i + 1).padStart(2, '0')}</span></Reveal>)}</div>
  </div></section>;
}

export function WorkflowSection() {
  return <section className="lp-section lp-workflow-section" id="workflow"><div className="lp-container">
    <div className="lp-split-heading"><Reveal><SectionHeading align="left" eyebrow="One continuous workflow" title={<>From recording<br /><span>to responsibility.</span></>} text="MeetSync follows the work from capture to completion without forcing your team to rebuild context in every tool." /></Reveal><Reveal delay={120}><p className="lp-split-note">Built to keep the original conversation, extracted insight, owner, and task status connected.</p></Reveal></div>
    <div className="lp-workflow-layout">
      <div className="lp-workflow-steps">{workflowSteps.map((step, i) => <Reveal className="lp-workflow-step" delay={i * 80} key={step.number}><div className="lp-step-number">{step.number}</div><div><span>{step.label}</span><h3>{step.title}</h3><p>{step.text}</p></div></Reveal>)}</div>
      <Reveal className="lp-workflow-demo" delay={140} variant="scale"><WorkflowVisual /></Reveal>
    </div>
  </div></section>;
}

export function CollaborationSection() {
  return <section className="lp-section lp-collaboration-section"><div className="lp-container lp-collaboration-layout">
    <Reveal className="lp-collab-copy"><SectionHeading align="left" eyebrow="Team execution" title={<>Clarity everyone<br /><span>can act on.</span></>} text="Give every action item an owner, every deadline visibility, and every teammate the context to move work forward." />
      <ul className="lp-check-list"><li><span><Check size={13} /></span>Match extracted owners to workspace members</li><li><span><Check size={13} /></span>Reassign work and preserve integration consistency</li><li><span><Check size={13} /></span>Comment, prioritize, track, and surface overdue tasks</li><li><span><Check size={13} /></span>Measure throughput and completion trends</li></ul>
      <Link className="lp-text-link" to="/register">Build your workspace <ArrowRight size={15} /></Link>
    </Reveal>
    <Reveal className="lp-collab-demo" delay={120} variant="scale"><CollaborationVisual /></Reveal>
  </div></section>;
}

export function IntegrationsSection() {
  return <section className="lp-section lp-integration-section" id="integrations"><div className="lp-container">
    <Reveal><SectionHeading eyebrow="Integrations" title={<>The conversation flows into<br /><span>the tools your team already uses.</span></>} text="Connect personal accounts and recording sources without turning your workflow into another manual process." /></Reveal>
    <div className="lp-integration-orbit">
      <div className="lp-orbit-center"><span><Sparkles size={24} /></span><b>MeetSync</b><small>Action engine</small></div>
      <div className="lp-orbit-ring lp-orbit-ring-one" /><div className="lp-orbit-ring lp-orbit-ring-two" />
      {integrationItems.map((item, i) => <Reveal className={`lp-integration-node lp-node-${i + 1}`} delay={i * 80} variant="scale" key={item.key}><div className="lp-integration-brand" style={{ '--brand': item.color }}>{item.key === 'meet' ? 'G' : item.name[0]}</div><div><h3>{item.name}</h3><p>{item.text}</p></div><span className="lp-status-dot">Connected</span></Reveal>)}
    </div>
  </div></section>;
}
