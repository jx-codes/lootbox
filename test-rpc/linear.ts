// Linear-like issue tracking API

interface Issue {
  id: string;
  identifier: string; // e.g., "ENG-123"
  title: string;
  description: string;
  status: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "canceled";
  priority: "no_priority" | "urgent" | "high" | "medium" | "low";
  assignee: User | null;
  creator: User;
  team: Team;
  labels: Label[];
  createdAt: string;
  updatedAt: string;
  estimate: number | null; // story points
  linkedTickets: string[]; // customer ticket IDs
  comments: Comment[];
}

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

interface Team {
  id: string;
  name: string;
  key: string; // e.g., "ENG"
}

interface Label {
  id: string;
  name: string;
  color: string;
}

interface Comment {
  id: string;
  body: string;
  author: User;
  createdAt: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock data
const MOCK_USERS: User[] = [
  {
    id: "user_eng_1",
    name: "Alex Rivera",
    email: "alex@company.com",
    avatarUrl: "https://i.pravatar.cc/150?u=alex"
  },
  {
    id: "user_eng_2",
    name: "Jamie Lee",
    email: "jamie@company.com",
    avatarUrl: "https://i.pravatar.cc/150?u=jamie"
  }
];

const MOCK_TEAMS: Team[] = [
  { id: "team_eng", name: "Engineering", key: "ENG" },
  { id: "team_prod", name: "Product", key: "PROD" }
];

const MOCK_LABELS: Label[] = [
  { id: "label_bug", name: "bug", color: "#e5484d" },
  { id: "label_feature", name: "feature", color: "#46a758" },
  { id: "label_customer", name: "customer-reported", color: "#0091ff" },
  { id: "label_export", name: "export", color: "#f76b15" }
];

const MOCK_ISSUES: Issue[] = [
  {
    id: "issue_eng_567",
    identifier: "ENG-567",
    title: "CSV export timeout for large datasets",
    description: "Users with enterprise accounts are experiencing timeouts when exporting >10k rows to CSV. Need to implement chunked/streaming export or background job processing.",
    status: "in_progress",
    priority: "urgent",
    assignee: MOCK_USERS[0],
    creator: MOCK_USERS[1],
    team: MOCK_TEAMS[0],
    labels: [MOCK_LABELS[0], MOCK_LABELS[2], MOCK_LABELS[3]],
    createdAt: "2025-09-29T10:15:00Z",
    updatedAt: "2025-09-30T09:30:00Z",
    estimate: 5,
    linkedTickets: ["zendesk_12847"],
    comments: [
      {
        id: "comment_1",
        body: "Looking into this - appears to be a database query timeout. The query is taking >30s for large result sets.",
        author: MOCK_USERS[0],
        createdAt: "2025-09-30T09:30:00Z"
      }
    ]
  },
  {
    id: "issue_eng_543",
    identifier: "ENG-543",
    title: "Implement streaming CSV export",
    description: "Add support for streaming large CSV exports to avoid memory issues and timeouts.",
    status: "todo",
    priority: "high",
    assignee: null,
    creator: MOCK_USERS[0],
    team: MOCK_TEAMS[0],
    labels: [MOCK_LABELS[1], MOCK_LABELS[3]],
    createdAt: "2025-09-25T14:00:00Z",
    updatedAt: "2025-09-25T14:00:00Z",
    estimate: 8,
    linkedTickets: [],
    comments: []
  }
];

/**
 * Search issues by various criteria
 */
export async function searchIssues(args: {
  query?: string;
  status?: string;
  priority?: string;
  teamId?: string;
  labels?: string[];
}): Promise<Issue[]> {
  await delay(175);

  let results = [...MOCK_ISSUES];

  if (args.query) {
    const query = args.query.toLowerCase();
    results = results.filter(i =>
      i.title.toLowerCase().includes(query) ||
      i.description.toLowerCase().includes(query)
    );
  }

  if (args.status) {
    results = results.filter(i => i.status === args.status);
  }

  if (args.priority) {
    results = results.filter(i => i.priority === args.priority);
  }

  if (args.teamId) {
    results = results.filter(i => i.team.id === args.teamId);
  }

  if (args.labels && args.labels.length > 0) {
    results = results.filter(i =>
      args.labels!.some(label => i.labels.some(l => l.name === label))
    );
  }

  return results;
}

/**
 * Get issue by ID or identifier
 */
export async function getIssue(args: { issueId: string }): Promise<Issue> {
  await delay(115);

  const issue = MOCK_ISSUES.find(i =>
    i.id === args.issueId || i.identifier === args.issueId
  );

  if (!issue) {
    throw new Error(`Issue ${args.issueId} not found`);
  }

  return issue;
}

/**
 * Create a new issue
 */
export async function createIssue(args: {
  title: string;
  description: string;
  teamId: string;
  priority?: string;
  assigneeId?: string;
  labels?: string[];
  linkedTicketId?: string;
}): Promise<Issue> {
  await delay(200);

  const team = MOCK_TEAMS.find(t => t.id === args.teamId);
  if (!team) {
    throw new Error(`Team ${args.teamId} not found`);
  }

  const issueNumber = MOCK_ISSUES.length + 1;
  const newIssue: Issue = {
    id: `issue_${args.teamId}_${issueNumber}`,
    identifier: `${team.key}-${issueNumber}`,
    title: args.title,
    description: args.description,
    status: "backlog",
    priority: (args.priority as any) || "medium",
    assignee: args.assigneeId ? MOCK_USERS.find(u => u.id === args.assigneeId) || null : null,
    creator: MOCK_USERS[1], // Default creator
    team,
    labels: args.labels ? MOCK_LABELS.filter(l => args.labels!.includes(l.name)) : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    estimate: null,
    linkedTickets: args.linkedTicketId ? [args.linkedTicketId] : [],
    comments: []
  };

  MOCK_ISSUES.push(newIssue);

  return newIssue;
}

/**
 * Update issue status or priority
 */
export async function updateIssue(args: {
  issueId: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
}): Promise<Issue> {
  await delay(140);

  const issue = MOCK_ISSUES.find(i => i.id === args.issueId || i.identifier === args.issueId);
  if (!issue) {
    throw new Error(`Issue ${args.issueId} not found`);
  }

  if (args.status) issue.status = args.status as any;
  if (args.priority) issue.priority = args.priority as any;
  if (args.assigneeId) {
    issue.assignee = MOCK_USERS.find(u => u.id === args.assigneeId) || null;
  }

  issue.updatedAt = new Date().toISOString();

  return issue;
}

/**
 * Add comment to issue
 */
export async function addComment(args: {
  issueId: string;
  body: string;
  authorId?: string;
}): Promise<Comment> {
  await delay(130);

  const issue = MOCK_ISSUES.find(i => i.id === args.issueId || i.identifier === args.issueId);
  if (!issue) {
    throw new Error(`Issue ${args.issueId} not found`);
  }

  const author = args.authorId
    ? MOCK_USERS.find(u => u.id === args.authorId) || MOCK_USERS[0]
    : MOCK_USERS[0];

  const comment: Comment = {
    id: `comment_${issue.comments.length + 1}`,
    body: args.body,
    author,
    createdAt: new Date().toISOString()
  };

  issue.comments.push(comment);
  issue.updatedAt = new Date().toISOString();

  return comment;
}

/**
 * Get issues linked to a customer ticket
 */
export async function getIssuesByTicket(args: { ticketId: string }): Promise<Issue[]> {
  await delay(105);

  return MOCK_ISSUES.filter(i => i.linkedTickets.includes(args.ticketId));
}
