import React from 'react';
import {
  BarChart3, Check, CheckCircle2, ChevronRight, Clock3, FileText,
  MessageSquare, Mic2, MoreHorizontal, Play, Sparkles, Users2, WandSparkles,
} from 'lucide-react';

export function HeroDashboard() {
  const tasks = [
    { title: 'Finalize launch brief', owner: 'AM', status: 'In progress', color: '#8b5cf6' },
    { title: 'Review onboarding flow', owner: 'SK', status: 'In review', color: '#22d3ee' },
    { title: 'Share rollout timeline', owner: 'JD', status: 'Backlog', color: '#34d399' },
  ];

  return (
    <div className="lp-product-shell" aria-label="MeetSync product dashboard preview">
      <div className="lp-product-topbar">
        <div className="lp-window-controls"><i /><i /><i /></div>
        <div className="lp-product-address"><span>app.meetsync.ai</span></div>
        <div className="lp-product-avatar">AL</div>
      </div>
      <div className="lp-product-body">
        <aside className="lp-product-sidebar">
          <div className="lp-mini-logo"><span><Sparkles size={13} /></span><b>MeetSync</b></div>
          <div className="lp-mini-nav active"><BarChart3 size={14} /> Overview</div>
          <div className="lp-mini-nav"><Mic2 size={14} /> Meetings</div>
          <div className="lp-mini-nav"><CheckCircle2 size={14} /> Tasks</div>
          <div className="lp-mini-nav"><Users2 size={14} /> Team</div>
        </aside>
        <div className="lp-dashboard-main">
          <div className="lp-dashboard-heading">
            <div><span className="lp-mock-kicker">WORKSPACE OVERVIEW</span><h3>Good morning, Alex</h3></div>
            <button type="button"><Play size={12} fill="currentColor" /> New meeting</button>
          </div>
          <div className="lp-metric-grid">
            <Metric label="Meetings" value="24" delta="+18%" color="violet" />
            <Metric label="Tasks captured" value="86" delta="+32%" color="cyan" />
            <Metric label="Completion" value="78%" delta="+9%" color="green" />
          </div>
          <div className="lp-dashboard-lower">
            <div className="lp-meeting-card">
              <div className="lp-mock-card-head"><span>Latest meeting</span><MoreHorizontal size={15} /></div>
              <div className="lp-meeting-title"><div className="lp-meeting-icon"><Mic2 size={17} /></div><div><b>Product launch sync</b><span>Today · 42 minutes</span></div></div>
              <div className="lp-processing-line"><i /><span>AI analysis complete</span><b>12 tasks</b></div>
              <div className="lp-waveform" aria-hidden="true">{Array.from({ length: 28 }).map((_, i) => <i key={i} style={{ '--h': `${22 + ((i * 19) % 58)}%` }} />)}</div>
              <div className="lp-insight"><WandSparkles size={14} /><span>7 decisions and 12 action items captured</span></div>
            </div>
            <div className="lp-tasks-card">
              <div className="lp-mock-card-head"><span>Priority tasks</span><b>View all <ChevronRight size={12} /></b></div>
              <div className="lp-task-list">
                {tasks.map(task => (
                  <div className="lp-task-row" key={task.title}>
                    <i style={{ '--task-color': task.color }} />
                    <div><b>{task.title}</b><span>{task.status}</span></div>
                    <strong>{task.owner}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="lp-floating-note lp-floating-note-one"><span><Check size={13} /></span><div><b>Task assigned</b><small>Sarah · just now</small></div></div>
      <div className="lp-floating-note lp-floating-note-two"><span><Sparkles size={13} /></span><div><b>AI summary ready</b><small>42 min → 90 sec read</small></div></div>
    </div>
  );
}

function Metric({ label, value, delta, color }) {
  return <div className={`lp-metric lp-metric-${color}`}><span>{label}</span><div><b>{value}</b><small>{delta}</small></div><svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M0,26 C18,24 18,15 35,18 S56,26 66,13 S85,7 100,3" /></svg></div>;
}

export function WorkflowVisual() {
  const transcript = [
    ['Alex', 'Let’s have the launch brief ready by Friday.'],
    ['Sarah', 'I’ll own the final review and share it with the team.'],
    ['Jordan', 'I can update the rollout timeline tomorrow.'],
  ];

  return (
    <div className="lp-workflow-visual">
      <div className="lp-transcript-panel">
        <div className="lp-panel-toolbar"><div><span className="lp-live-dot" /> Product launch sync</div><span>42:16</span></div>
        <div className="lp-transcript-wave"><button type="button" aria-label="Play preview"><Play size={13} fill="currentColor" /></button><div>{Array.from({ length: 34 }).map((_, i) => <i key={i} style={{ '--h': `${20 + ((i * 13) % 64)}%` }} />)}</div></div>
        <div className="lp-transcript-copy">
          {transcript.map(([name, text], index) => <div key={name}><span className={`lp-speaker lp-speaker-${index + 1}`}>{name[0]}</span><p><b>{name}</b>{text}</p></div>)}
        </div>
      </div>
      <div className="lp-visual-connector"><Sparkles size={16} /></div>
      <div className="lp-extraction-panel">
        <div className="lp-panel-toolbar"><div><WandSparkles size={14} /> AI extraction</div><span className="lp-ready-pill">Ready</span></div>
        <div className="lp-extracted-task"><span className="lp-check-box"><Check size={12} /></span><div><b>Finalize launch brief</b><p>Sarah · Friday</p></div><small>HIGH</small></div>
        <div className="lp-extracted-task"><span className="lp-check-box"><Check size={12} /></span><div><b>Update rollout timeline</b><p>Jordan · Tomorrow</p></div><small>MEDIUM</small></div>
        <div className="lp-decision-chip"><FileText size={14} /><span><b>Decision captured</b>Launch remains scheduled for next Tuesday.</span></div>
      </div>
    </div>
  );
}

export function CollaborationVisual() {
  return (
    <div className="lp-collab-visual">
      <div className="lp-kanban-head"><div><span>Launch workspace</span><b>12 tasks across 3 meetings</b></div><div className="lp-avatar-stack"><i>AM</i><i>SK</i><i>JD</i><i>+4</i></div></div>
      <div className="lp-kanban-grid">
        <KanbanColumn title="Backlog" count="3" cards={[
          ['Create FAQ copy', 'SK', 'Tomorrow', 'cyan'],
          ['QA billing flow', 'JD', 'Friday', 'violet'],
        ]} />
        <KanbanColumn title="In progress" count="4" cards={[
          ['Finalize launch brief', 'AM', 'Today', 'amber'],
          ['Update product tour', 'SK', 'Thursday', 'green'],
        ]} />
        <KanbanColumn title="Done" count="5" cards={[
          ['Approve launch scope', 'JD', 'Complete', 'green', true],
          ['Confirm support rota', 'AM', 'Complete', 'green', true],
        ]} />
      </div>
      <div className="lp-comment-popover"><MessageSquare size={13} /><div><b>Sarah</b><span>Final copy is ready for review.</span></div><small>2m</small></div>
    </div>
  );
}

function KanbanColumn({ title, count, cards }) {
  return <div className="lp-kanban-column"><div className="lp-kanban-title"><span>{title}</span><b>{count}</b></div>{cards.map(([name, owner, date, color, done]) => <div className={`lp-kanban-card ${done ? 'is-done' : ''}`} key={name}><i className={`lp-priority-${color}`} /><b>{name}</b><div><span>{owner}</span><small><Clock3 size={10} /> {date}</small></div></div>)}</div>;
}
