import { parse as parseYaml } from "jsr:@std/yaml@^1.0.0";
import type { FlowState } from "./types.ts";

const STATE_FILE = ".lootbox-workflow.json";

interface WorkflowStep {
  title: string;
  prompt: string;
  loop?: { min: number; max: number };
}

interface WorkflowFile {
  steps: WorkflowStep[];
}

export async function loadWorkflowState(): Promise<FlowState | null> {
  try {
    const stateText = await Deno.readTextFile(STATE_FILE);
    return JSON.parse(stateText);
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
      `Failed to parse workflow file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function displayStep(state: FlowState, endLoop = false): Promise<void> {
  const content = await Deno.readTextFile(state.file);
  const steps = parseWorkflowFile(content);

  if (state.section >= steps.length) {
    console.log("Workflow complete! All steps have been shown.");
    await deleteWorkflowState();
    Deno.exit(0);
  }

  const step = steps[state.section];
  const iteration = state.loopIteration || 1;

  // Display step title
  console.log(`## ${step.title}`);

  // Display prompt first (main content)
  console.log(`\n${step.prompt}`);

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
      console.log(`Status: Maximum iterations reached. Auto-advancing to next step.`);
    } else if (canEndLoop) {
      console.log(
        `Next: 'lootbox workflow step --end-loop' to advance, 'lootbox workflow step' to repeat`
      );
    } else {
      console.log(
        `Required: ${step.loop.min - iteration} more iteration(s) before --end-loop is allowed`
      );
    }
  }
}

export async function workflowStart(file: string): Promise<void> {
  try {
    const content = await Deno.readTextFile(file);
    const steps = parseWorkflowFile(content);

    if (steps.length === 0) {
      console.error(`Error: No steps found in ${file}`);
      console.error("Workflow files should have a 'steps' array with at least one step");
      Deno.exit(1);
    }

    await saveWorkflowState({ file, section: 0 });
    console.log(`Workflow started: ${file}`);
    console.log(`Total steps: ${steps.length}`);
    console.log(`\nRun 'lootbox workflow step' to see the first step`);
  } catch (error) {
    console.error(
      `Error reading file '${file}':`,
      error instanceof Error ? error.message : String(error)
    );
    Deno.exit(1);
  }
}

export async function workflowStep(endLoop = false): Promise<void> {
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
      await deleteWorkflowState();
      Deno.exit(0);
    }

    const step = steps[state.section];
    const iteration = state.loopIteration || 1;

    // Handle --end-loop flag
    if (endLoop) {
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

      // End loop and advance, then display next step
      await saveWorkflowState({ ...state, section: state.section + 1, loopIteration: undefined });
      console.log(`Loop ended. Advancing to next step...\n`);

      // Recursively display next step
      const newState = await loadWorkflowState();
      if (newState) {
        await displayStep(newState);
      }
      return;
    }

    // Normal step display
    await displayStep(state);

    // Handle loop logic for next invocation
    if (step.loop) {
      if (iteration >= step.loop.max) {
        // Max reached, auto-advance
        await saveWorkflowState({ ...state, section: state.section + 1, loopIteration: undefined });
      } else {
        // Increment iteration, stay on same section
        await saveWorkflowState({ ...state, loopIteration: iteration + 1 });
      }
    } else {
      // No loop, advance to next section
      await saveWorkflowState({ ...state, section: state.section + 1, loopIteration: undefined });
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
  } catch (error) {
    console.error(
      `Error reading workflow file '${state.file}':`,
      error instanceof Error ? error.message : String(error)
    );
    Deno.exit(1);
  }
}
