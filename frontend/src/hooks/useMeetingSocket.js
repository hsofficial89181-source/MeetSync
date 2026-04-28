import { useEffect, useRef } from 'react';
import { useStore } from '../store';

/**
 * Opens a WebSocket and subscribes to pipeline progress for a meeting.
 *
 * Skips the connection entirely if the meeting is already in a terminal
 * state (done / error) — no point wasting a socket.
 *
 * @param {string}  meetingId
 * @param {string}  meetingStatus  — current status from DB ('pending'|'transcribing'|...|'done'|'error')
 */
export function useMeetingSocket(meetingId, meetingStatus) {
  const ws = useRef(null);
  const { setProcessingStep, setProcessingDone, setProcessingError, updateMeeting, fetchTasks } =
    useStore();

  const isTerminal = meetingStatus === 'done' || meetingStatus === 'error' || meetingStatus === 'cancelled';

  useEffect(() => {
    if (!meetingId || isTerminal) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    ws.current = new WebSocket(`${protocol}://${window.location.host}/ws`);

    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ type: 'subscribe', meetingId }));
    };

    ws.current.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        switch (msg.event) {
          case 'step':
            setProcessingStep(meetingId, msg.data);
            updateMeeting(meetingId, { status: msg.data.step });
            break;
          case 'done':
            setProcessingDone(meetingId, msg.data);
            updateMeeting(meetingId, { status: 'done', ...msg.data });
            fetchTasks();
            // Close the socket — we're done
            ws.current?.close();
            break;
          case 'error':
            setProcessingError(meetingId, msg.data.message);
            updateMeeting(meetingId, { status: 'error', error_message: msg.data.message });
            ws.current?.close();
            break;
          case 'cancelled':
            updateMeeting(meetingId, { status: 'cancelled' });
            ws.current?.close();
            break;
          default:
            break;
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.current.onerror = () => {
      setProcessingError(meetingId, 'WebSocket connection failed');
    };

    return () => {
      ws.current?.close();
    };
  }, [meetingId, isTerminal]);
}
