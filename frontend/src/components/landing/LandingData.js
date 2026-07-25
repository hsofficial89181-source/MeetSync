import {
  AudioWaveform, Bot, BrainCircuit, TrendingUp, CheckCircle2,
  Clock3, FileSearch, MessageSquareText, Search, ShieldCheck, Sparkles,
  Target, UsersRound, Workflow,
} from 'lucide-react';

export const navItems = [
  { label: 'Product', href: '#product' },
  { label: 'Workflow', href: '#workflow' },
  { label: 'Integrations', href: '#integrations' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export const valueCards = [
  {
    icon: Clock3,
    eyebrow: 'Less follow-up',
    title: 'Leave the meeting with clarity',
    text: 'Every commitment, owner, decision, and deadline is captured while the conversation is still fresh.',
    accent: 'violet',
  },
  {
    icon: Target,
    eyebrow: 'More ownership',
    title: 'Turn discussion into momentum',
    text: 'MeetSync matches action items to your team and moves work into one focused execution board.',
    accent: 'cyan',
  },
  {
    icon: Workflow,
    eyebrow: 'Zero copy-paste',
    title: 'Keep your tools in sync',
    text: 'Assigned tasks flow to connected Slack and Notion accounts without manual handoffs.',
    accent: 'green',
  },
];

export const features = [
  { icon: AudioWaveform, title: 'High-fidelity transcription', text: 'Transform meeting recordings into a structured, speaker-aware transcript ready to search and share.' },
  { icon: BrainCircuit, title: 'AI action extraction', text: 'Surface explicit commitments, owners, priorities, due dates, blockers, and follow-ups automatically.' },
  { icon: MessageSquareText, title: 'Decisions, preserved', text: 'Separate key decisions from conversation noise so teams can return to the reasoning behind the work.' },
  { icon: UsersRound, title: 'Confident assignment', text: 'Match named owners to real workspace members, then reassign work cleanly whenever plans change.' },
  { icon: CheckCircle2, title: 'Execution-ready task board', text: 'Move tasks from backlog to done, manage deadlines, comment with context, and see overdue work early.' },
  { icon: TrendingUp, title: 'Operational analytics', text: 'Track completion trends, meeting volume, team workload, priority mix, and estimated time saved.' },
  { icon: Search, title: 'Searchable meeting memory', text: 'Find past meetings, tasks, decisions, and owners without digging through notes or message history.' },
  { icon: FileSearch, title: 'Share and export', text: 'Create secure read-only links and export task CSVs or meeting reports whenever work needs to travel.' },
  { icon: ShieldCheck, title: 'Workspace control', text: 'Keep billing, member access, workspace settings, and role-aware administration in one place.' },
];

export const workflowSteps = [
  { number: '01', label: 'Capture', title: 'Upload or import', text: 'Add an audio or video recording, or bring it in from Zoom and Google Meet.' },
  { number: '02', label: 'Understand', title: 'Transcribe and analyze', text: 'AI creates a transcript, executive summary, decisions, and explicit action items.' },
  { number: '03', label: 'Organize', title: 'Match owners and dates', text: 'Action items are matched to workspace members with priorities and deadlines intact.' },
  { number: '04', label: 'Execute', title: 'Sync and track', text: 'Tasks reach Slack and Notion, while the team manages progress from a shared board.' },
];

export const integrationItems = [
  { key: 'slack', name: 'Slack', text: 'Send meeting summaries and task notifications, with automatic assignee delivery.', color: '#e01e5a' },
  { key: 'notion', name: 'Notion', text: 'Create structured meeting pages and keep individual assigned tasks in view.', color: '#f3f1ed' },
  { key: 'zoom', name: 'Zoom', text: 'Import cloud recordings after calls end and begin processing without manual uploads.', color: '#2d8cff' },
  { key: 'meet', name: 'Google Meet', text: 'Bring recordings in from Google Drive and connect conversations to execution.', color: '#00ac47' },
];

export const planCatalog = [
  {
    name: 'Starter', monthly: 99, yearly: 999, monthlyHours: 10, yearlyHours: 120,
    description: 'For focused teams building a reliable meeting-to-action habit.',
    features: ['AI transcription and summaries', 'Tasks, decisions, and owners', 'Central task board', 'Searchable meeting history'],
  },
  {
    name: 'Professional', monthly: 299, yearly: 3499, monthlyHours: 30, yearlyHours: 360,
    description: 'For growing teams running more meetings with faster turnaround.',
    features: ['Everything in Starter', 'Higher meeting usage', 'Priority processing', 'Priority support'],
    featured: true,
  },
  {
    name: 'Business', monthly: 799, yearly: 9499, monthlyHours: 80, yearlyHours: 960,
    description: 'For multi-team operations that need capacity and consistent execution.',
    features: ['Everything in Starter', 'Expanded usage capacity', 'Priority processing', 'Priority support'],
  },
  {
    name: 'Enterprise', monthly: 3499, yearly: 39999, monthlyHours: 350, yearlyHours: 4200,
    description: 'For organizations managing meeting intelligence at significant scale.',
    features: ['Everything in Starter', 'Enterprise-scale usage', 'Priority processing', 'Priority support'],
  },
];

export const faqs = [
  { q: 'What happens during the 7-day free trial?', a: 'A new workspace starts with a seven-day Starter trial. You can upload meetings, generate transcripts, extract action items, and explore the execution workflow before choosing a paid plan.' },
  { q: 'What does MeetSync extract from a meeting?', a: 'MeetSync creates a transcript and summary, captures key decisions, and extracts explicit action items with owners, due dates, priorities, labels, and source context where available.' },
  { q: 'How are tasks assigned to team members?', a: 'AI-extracted names are matched against the members in your workspace. Admins control workspace membership and job titles, while task assignees and due dates can be adjusted from the task board.' },
  { q: 'How do Slack and Notion sync work?', a: 'When a task is assigned, MeetSync checks the assignee’s connected accounts. Connected integrations sync immediately; if an account is connected later, pending tasks can be delivered then.' },
  { q: 'Which meeting sources are supported?', a: 'You can upload common audio and video recordings directly. MeetSync also supports integrations for Zoom and Google Meet recording workflows.' },
  { q: 'Can I share or export the results?', a: 'Yes. Completed meetings can be shared through read-only links, tasks can be exported as CSV, and meeting reports can be downloaded for use outside the workspace.' },
  { q: 'Can I change or cancel a subscription?', a: 'Workspace admins can manage plans, payment details, invoices, cancellation, and reactivation from the billing area. Plan availability and included hours are shown before checkout.' },
];

export const proofItems = [
  { icon: Sparkles, value: 'Conversation → action', label: 'One continuous AI workflow' },
  { icon: Bot, value: 'Context stays attached', label: 'Tasks link back to meetings' },
  { icon: UsersRound, value: 'Built for real teams', label: 'Owners, roles, comments, progress' },
];
