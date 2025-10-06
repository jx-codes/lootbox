// Workflow event logging using SQLite
// Stores workflow execution history in a centralized lootbox.db

import { getDb, closeDb as closeDatabase } from "./db.ts";

export type WorkflowEventType =
  | "start"
  | "step"
  | "loop_iteration"
  | "end_loop"
  | "abort"
  | "reset"
  | "complete";

export interface WorkflowEvent {
  id?: number;
  timestamp: number;
  event_type: WorkflowEventType;
  workflow_file: string;
  step_number: number | null;
  loop_iteration: number | null;
  reason: string | null;
  session_id: string | null;
}

/**
 * Generate a session ID for grouping related workflow runs
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  return `wf-${timestamp}-${randomId}`;
}

/**
 * Log a workflow event
 */
export async function logWorkflowEvent(event: Omit<WorkflowEvent, "id">): Promise<void> {
  try {
    const db = await getDb();

    db.query(
      `INSERT INTO workflow_events (
        timestamp, event_type, workflow_file, step_number,
        loop_iteration, reason, session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        event.timestamp,
        event.event_type,
        event.workflow_file,
        event.step_number,
        event.loop_iteration,
        event.reason,
        event.session_id,
      ]
    );
  } catch (error) {
    console.error(
      `Failed to log workflow event:`,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Get recent workflow events
 */
export async function getRecentEvents(limit = 50): Promise<WorkflowEvent[]> {
  try {
    const db = await getDb();

    const results = db.queryEntries<{
      id: number;
      timestamp: number;
      event_type: string;
      workflow_file: string;
      step_number: number | null;
      loop_iteration: number | null;
      reason: string | null;
      session_id: string | null;
    }>(
      `SELECT id, timestamp, event_type, workflow_file, step_number,
              loop_iteration, reason, session_id
       FROM workflow_events
       ORDER BY timestamp DESC
       LIMIT ?`,
      [limit]
    );

    return results as WorkflowEvent[];
  } catch (error) {
    console.error(
      `Failed to get recent events:`,
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

/**
 * Get events for a specific workflow file
 */
export async function getEventsForWorkflow(workflowFile: string, limit = 100): Promise<WorkflowEvent[]> {
  try {
    const db = await getDb();

    const results = db.queryEntries<{
      id: number;
      timestamp: number;
      event_type: string;
      workflow_file: string;
      step_number: number | null;
      loop_iteration: number | null;
      reason: string | null;
      session_id: string | null;
    }>(
      `SELECT id, timestamp, event_type, workflow_file, step_number,
              loop_iteration, reason, session_id
       FROM workflow_events
       WHERE workflow_file = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      [workflowFile, limit]
    );

    return results as WorkflowEvent[];
  } catch (error) {
    console.error(
      `Failed to get workflow events:`,
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

/**
 * Get events for a specific session
 */
export async function getEventsForSession(sessionId: string): Promise<WorkflowEvent[]> {
  try {
    const db = await getDb();

    const results = db.queryEntries<{
      id: number;
      timestamp: number;
      event_type: string;
      workflow_file: string;
      step_number: number | null;
      loop_iteration: number | null;
      reason: string | null;
      session_id: string | null;
    }>(
      `SELECT id, timestamp, event_type, workflow_file, step_number,
              loop_iteration, reason, session_id
       FROM workflow_events
       WHERE session_id = ?
       ORDER BY timestamp ASC`,
      [sessionId]
    );

    return results as WorkflowEvent[];
  } catch (error) {
    console.error(
      `Failed to get session events:`,
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

/**
 * Close the database connection
 */
export const closeDb = closeDatabase;
