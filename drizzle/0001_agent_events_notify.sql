-- Realtime bus trigger: fires NOTIFY on every agent_events insert so the SSE
-- bus can pick it up and push to live clients.

CREATE OR REPLACE FUNCTION notify_agent_event_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('agent_events', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_events_notify ON agent_events;
CREATE TRIGGER agent_events_notify
AFTER INSERT ON agent_events
FOR EACH ROW EXECUTE FUNCTION notify_agent_event_insert();
