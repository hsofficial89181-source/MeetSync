/**
 * WebSocket service
 * Streams pipeline progress to the frontend in real time.
 * Clients subscribe to a specific meetingId.
 */

const clients = new Map(); // meetingId -> Set<WebSocket>

function setupWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    // Client sends { type: 'subscribe', meetingId: '...' } on connect
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribe' && msg.meetingId) {
          subscribeToMeeting(ws, msg.meetingId);
          ws.send(JSON.stringify({ event: 'subscribed', meetingId: msg.meetingId }));
        }
      } catch (e) {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      // Remove from all meeting subscriptions
      for (const [meetingId, sockets] of clients.entries()) {
        sockets.delete(ws);
        if (sockets.size === 0) clients.delete(meetingId);
      }
    });
  });
}

function subscribeToMeeting(ws, meetingId) {
  if (!clients.has(meetingId)) clients.set(meetingId, new Set());
  clients.get(meetingId).add(ws);
}

function broadcastToMeeting(meetingId, message) {
  const sockets = clients.get(meetingId);
  if (!sockets || sockets.size === 0) return;

  const payload = JSON.stringify(message);
  for (const ws of sockets) {
    if (ws.readyState === 1) { // OPEN
      ws.send(payload);
    }
  }
}

module.exports = { setupWebSocket, broadcastToMeeting };
