import { HandlebarsJS } from "https://deno.land/x/handlebars/mod.ts";
import { parse as parseYaml } from "jsr:@std/yaml@^1.0.0";
import { generateSessionId, logWorkflowEvent } from "../workflow_log.ts";
import type { FlowState } from "./types.ts";

const STATE_FILE = ".lootbox-workflow.json";

// Session ID for current workflow run (generated on start, persisted in state)
let currentSessionId: string | null = null;

interface WorkflowStep {
  title: string;
  prompt: string;
  loop?: { min: number; max: number };
}

interface WorkflowFile {
  steps: WorkflowStep[];
}

interface TemplateContext {
  loop?: number; // Current loop iteration (1-based), only in loop steps
  step: number; // Current step number (1-based)
  totalSteps: number; // Total steps in workflow
}

// Register Handlebars helpers
HandlebarsJS.registerHelper("eq", (a: unknown, b: unknown) => a === b);
HandlebarsJS.registerHelper("ne", (a: unknown, b: unknown) => a !== b);
HandlebarsJS.registerHelper("lt", (a: number, b: number) => a < b);
HandlebarsJS.registerHelper("gt", (a: number, b: number) => a > b);
HandlebarsJS.registerHelper("lte", (a: number, b: number) => a <= b);
HandlebarsJS.registerHelper("gte", (a: number, b: number) => a >= b);

export async function loadWorkflowState(): Promise<FlowState | null> {
  try {
    const stateText = await Deno.readTextFile(STATE_FILE);
    const state = JSON.parse(stateText);
    currentSessionId = state.sessionId || null;
    return state;
  } catch {
    return null;
  }
}

export async function saveWorkflowState(state: FlowState): Promise<void> {
  await Deno.writeTextFile(STATE_FILE, JSON.stringify(state, null, 2));
}

export async function deleteWorkflowState(): Promise<void> {
  try {
    await Deno.remove(STATE_FILE);
  } catch {
    // Ignore if file doesn't exist
  }
}

function parseWorkflowFile(content: string): WorkflowStep[] {
  try {
    const parsed = parseYaml(content) as WorkflowFile;
    if (!parsed.steps || !Array.isArray(parsed.steps)) {
      throw new Error("Invalid workflow file: missing 'steps' array");
    }
    return parsed.steps;
  } catch (error) {
    throw new Error(
      `Failed to parse workflow file: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function displayStep(
  state: FlowState,
  endLoop = false,
  endLoopReason?: string
): Promise<void> {
  const content = await Deno.readTextFile(state.file);
  const steps = parseWorkflowFile(content);

  if (state.section >= steps.length) {
    console.log("Workflow complete! All steps have been shown.");
    await deleteWorkflowState();
    Deno.exit(0);
  }

  const step = steps[state.section];
  const iteration = state.loopIteration || 1;

  // Build template context
  const context: TemplateContext = {
    step: state.section + 1,
    totalSteps: steps.length,
  };

  // Only include loop if this is a loop step
  if (step.loop) {
    context.loop = iteration;
  }

  // Render title and prompt through Handlebars
  const titleTemplate = HandlebarsJS.compile(step.title);
  const promptTemplate = HandlebarsJS.compile(step.prompt);
  const renderedTitle = titleTemplate(context);
  const renderedPrompt = promptTemplate(context);

  // Display step title
  console.log(`## ${renderedTitle}`);

  // Display prompt first (main content)
  console.log(`\n${renderedPrompt}`);

  // Display metadata at the bottom, separated
  console.log(`\n---`);

  // Display progress
  console.log(`Step ${state.section + 1}/${steps.length}`);

  // Display loop metadata if present
  if (step.loop && !endLoop) {
    const canEndLoop = iteration >= step.loop.min;
    const atMax = iteration >= step.loop.max;

    console.log(
      `Loop: iteration ${iteration}/${step.loop.max} (min: ${step.loop.min})`
    );

    if (atMax) {
      console.log(
        `Status: Maximum iterations reached. Auto-advancing to next step.`
      );
    } else if (canEndLoop) {
      console.log(
        `Next: 'lootbox workflow step --end-loop="reason"' to advance, 'lootbox workflow step' to repeat`
      );
    } else {
      console.log(
        `Required: ${
          step.loop.min - iteration
        } more iteration(s) before --end-loop is allowed`
      );
    }
  }
}

async function resolveWorkflowPath(file: string): Promise<string> {
  // Try the path as-is first
  try {
    await Deno.stat(file);
    return file;
  } catch {
    // If not found, try in .lootbox/workflows/
    const { get_config } = await import("../get_config.ts");
    const config = await get_config();
    const fallbackPath = `${config.lootbox_root}/workflows/${file}`;
    try {
      await Deno.stat(fallbackPath);
      return fallbackPath;
    } catch {
      // Return original path so error message is accurate
      return file;
    }
  }
}

export async function workflowStart(file: string): Promise<void> {
  const resolvedPath = await resolveWorkflowPath(file);
  try {
    const content = await Deno.readTextFile(resolvedPath);
    const steps = parseWorkflowFile(content);

    if (steps.length === 0) {
      console.error(`Error: No steps found in ${resolvedPath}`);
      console.error(
        "Workflow files should have a 'steps' array with at least one step"
      );
      Deno.exit(1);
    }

    // Generate new session ID
    currentSessionId = generateSessionId();

    await saveWorkflowState({
      file: resolvedPath,
      section: 0,
      sessionId: currentSessionId,
    });

    // Log workflow start event
    await logWorkflowEvent({
      timestamp: Date.now(),
      event_type: "start",
      workflow_file: resolvedPath,
      step_number: null,
      loop_iteration: null,
      reason: null,
      session_id: currentSessionId,
    });

    console.log(`Workflow started: ${resolvedPath}`);
    console.log(`Total steps: ${steps.length}`);
    console.log(`\nRun 'lootbox workflow step' to see the first step`);
  } catch (error) {
    console.error(
      `Error reading file '${resolvedPath}':`,
      error instanceof Error ? error.message : String(error)
    );
    Deno.exit(1);
  }
}

export async function workflowStep(endLoopReason?: string): Promise<void> {
  const state = await loadWorkflowState();
  if (!state) {
    console.error("Error: No active workflow");
    console.error("Start a workflow with: lootbox workflow start <file>");
    Deno.exit(1);
  }

  try {
    const content = await Deno.readTextFile(state.file);
    const steps = parseWorkflowFile(content);

    if (state.section >= steps.length) {
      console.log("Workflow complete! All steps have been shown.");

      // Log completion event
      await logWorkflowEvent({
        timestamp: Date.now(),
        event_type: "complete",
        workflow_file: state.file,
        step_number: state.section,
        loop_iteration: null,
        reason: null,
        session_id: currentSessionId,
      });

      await deleteWorkflowState();
      Deno.exit(0);
    }

    const step = steps[state.section];
    const iteration = state.loopIteration || 1;

    // Handle --end-loop flag
    if (endLoopReason !== undefined) {
      if (!step.loop) {
        console.error("Error: Current step is not a loop");
        Deno.exit(1);
      }

      if (iteration < step.loop.min) {
        console.error(
          `Error: Cannot end loop. Minimum ${step.loop.min} iterations required (currently at ${iteration})`
        );
        Deno.exit(1);
      }

      // Log end_loop event
      await logWorkflowEvent({
        timestamp: Date.now(),
        event_type: "end_loop",
        workflow_file: state.file,
        step_number: state.section + 1,
        loop_iteration: iteration,
        reason: endLoopReason,
        session_id: currentSessionId,
      });

      // End loop and advance, then display next step
      await saveWorkflowState({
        ...state,
        section: state.section + 1,
        loopIteration: undefined,
      });
      console.log(`Loop ended. Advancing to next step...\n`);

      // Recursively display next step
      const newState = await loadWorkflowState();
      if (newState) {
        await displayStep(newState, false);
      }
      return;
    }

    // Normal step display
    await displayStep(state, false);

    // Log step event (either normal step or loop iteration)
    if (step.loop) {
      await logWorkflowEvent({
        timestamp: Date.now(),
        event_type: "loop_iteration",
        workflow_file: state.file,
        step_number: state.section + 1,
        loop_iteration: iteration,
        reason: null,
        session_id: currentSessionId,
      });
    } else {
      await logWorkflowEvent({
        timestamp: Date.now(),
        event_type: "step",
        workflow_file: state.file,
        step_number: state.section + 1,
        loop_iteration: null,
        reason: null,
        session_id: currentSessionId,
      });
    }

    // Handle loop logic for next invocation
    if (step.loop) {
      if (iteration >= step.loop.max) {
        // Max reached, auto-advance
        await saveWorkflowState({
          ...state,
          section: state.section + 1,
          loopIteration: undefined,
        });
      } else {
        // Increment iteration, stay on same section
        await saveWorkflowState({ ...state, loopIteration: iteration + 1 });
      }
    } else {
      // No loop, advance to next section
      await saveWorkflowState({
        ...state,
        section: state.section + 1,
        loopIteration: undefined,
      });
    }
  } catch (error) {
    console.error(
      `Error reading workflow file '${state.file}':`,
      error instanceof Error ? error.message : String(error)
    );
    Deno.exit(1);
  }
}

export async function workflowReset(): Promise<void> {
  const state = await loadWorkflowState();
  if (!state) {
    console.error("Error: No active workflow");
    Deno.exit(1);
  }

  // Log reset event
  await logWorkflowEvent({
    timestamp: Date.now(),
    event_type: "reset",
    workflow_file: state.file,
    step_number: state.section + 1,
    loop_iteration: state.loopIteration || null,
    reason: null,
    session_id: currentSessionId,
  });

  await saveWorkflowState({ ...state, section: 0, loopIteration: undefined });
  console.log(`Workflow reset: ${state.file}`);
  console.log(`Run 'lootbox workflow step' to start from the beginning`);
}

export async function workflowStatus(): Promise<void> {
  const state = await loadWorkflowState();
  if (!state) {
    console.log("No active workflow");
    return;
  }

  try {
    const content = await Deno.readTextFile(state.file);
    const steps = parseWorkflowFile(content);
    console.log(`Active workflow: ${state.file}`);
    console.log(`Current step: ${state.section + 1}/${steps.length}`);
    if (state.loopIteration) {
      const step = steps[state.section];
      if (step.loop) {
        console.log(
          `Loop iteration: ${state.loopIteration}/${step.loop.max} (min: ${step.loop.min})`
        );
      }
    }
    if (state.sessionId) {
      console.log(`Session ID: ${state.sessionId}`);
    }
  } catch (error) {
    console.error(
      `Error reading workflow file '${state.file}':`,
      error instanceof Error ? error.message : String(error)
    );
    Deno.exit(1);
  }
}

export async function workflowAbort(reason: string): Promise<void> {
  const state = await loadWorkflowState();
  if (!state) {
    console.error("Error: No active workflow");
    Deno.exit(1);
  }

  // Log abort event
  await logWorkflowEvent({
    timestamp: Date.now(),
    event_type: "abort",
    workflow_file: state.file,
    step_number: state.section + 1,
    loop_iteration: state.loopIteration || null,
    reason: reason,
    session_id: currentSessionId,
  });

  console.log(`Workflow aborted: ${reason}`);
  await deleteWorkflowState();
}
