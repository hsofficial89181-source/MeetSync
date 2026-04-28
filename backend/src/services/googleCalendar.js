/**
 * Google Calendar Write-Back
 *
 * After a meeting is processed, updates the original Google Calendar event
 * with a summary, task list, and decisions in the event description.
 *
 * Setup: same OAuth as Google Meet integration (GOOGLE_REFRESH_TOKEN)
 */

const axios = require('axios');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API    = 'https://www.googleapis.com/calendar/v3';

let cachedToken  = null;
let tokenExpiry  = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;
  const { data } = await axios.post(GOOGLE_TOKEN_URL, {
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type:    'refresh_token',
  });
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

/**
 * Write meeting summary back to the Google Calendar event.
 * Called after pipeline completes for meetings sourced from Google Meet.
 *
 * @param {string} googleEventId  - from meetings.google_event_id
 * @param {string} calendarId     - usually 'primary'
 * @param {object} meeting
 * @param {Array}  tasks
 * @param {Array}  decisions
 * @param {string} summary
 */
async function writeBackToCalendar(googleEventId, meeting, tasks, decisions, summary, config = {}) {
  if (!googleEventId) return;
  if (!process.env.GOOGLE_REFRESH_TOKEN && !config.oauth_token) {
    console.warn('Calendar write-back: no Google token configured, skipping');
    return;
  }

  const token      = config.oauth_token || (await getToken());
  const calendarId = config.calendar_id || 'primary';
  const headers    = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Fetch current event to preserve existing fields
  let event;
  try {
    const { data } = await axios.get(
      `${CALENDAR_API}/calendars/${calendarId}/events/${googleEventId}`,
      { headers }
    );
    event = data;
  } catch (err) {
    console.warn(`Calendar: Could not fetch event ${googleEventId}:`, err.message);
    return;
  }

  const priorityEmoji = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };

  const taskLines = tasks.slice(0, 20).map(t =>
    `${priorityEmoji[t.priority] || '🟡'} ${t.title}${t.assignee_name ? ' → ' + t.assignee_name : ''}${t.due_date ? ' (due ' + t.due_date + ')' : ''}`
  ).join('\n');

  const decisionLines = decisions.map(d =>
    `✅ ${d.description}${d.owner_name ? ' — ' + d.owner_name : ''}`
  ).join('\n');

  const meetsyncBlock = [
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '⚡ MeetSync AI Summary',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    summary || '',
    '',
    decisions.length > 0 ? `Key Decisions:\n${decisionLines}` : '',
    '',
    tasks.length > 0 ? `Action Items (${tasks.length}):\n${taskLines}` : '',
    tasks.length > 20 ? `\n…and ${tasks.length - 20} more tasks` : '',
    '',
  ].filter(l => l !== '').join('\n');

  // Prepend to existing description
  const existingDesc = event.description || '';
  // Remove any previous MeetSync block
  const cleanDesc = existingDesc.replace(/━+\n⚡ MeetSync AI Summary[\s\S]*$/, '').trim();
  const newDesc   = cleanDesc + meetsyncBlock;

  await axios.patch(
    `${CALENDAR_API}/calendars/${calendarId}/events/${googleEventId}`,
    { description: newDesc },
    { headers }
  );

  console.log(`Calendar: Updated event "${event.summary}" with MeetSync summary`);
}

/**
 * List upcoming meetings from Google Calendar (used for proactive import)
 */
async function getUpcomingMeetings(config = {}) {
  const token = config.oauth_token || (await getToken());
  const calendarId = config.calendar_id || 'primary';

  const now     = new Date().toISOString();
  const oneWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await axios.get(
    `${CALENDAR_API}/calendars/${calendarId}/events`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        timeMin:      now,
        timeMax:      oneWeek,
        singleEvents: true,
        orderBy:      'startTime',
        maxResults:   20,
        q:            'meet.google.com',  // Only events with Meet links
      },
    }
  );

  return (data.items || []).map(e => ({
    id:       e.id,
    title:    e.summary,
    start:    e.start?.dateTime,
    end:      e.end?.dateTime,
    meet_url: e.hangoutLink,
    attendees:(e.attendees || []).map(a => a.email),
  }));
}

module.exports = { writeBackToCalendar, getUpcomingMeetings };
