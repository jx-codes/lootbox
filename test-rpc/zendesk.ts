// Zendesk-like customer support ticket API

interface Ticket {
  id: number;
  subject: string;
  description: string;
  status: "new" | "open" | "pending" | "solved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  customerId: string;
  customerEmail: string;
  assigneeId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  comments: TicketComment[];
}

interface TicketComment {
  id: number;
  ticketId: number;
  authorId: string;
  authorName: string;
  body: string;
  isPublic: boolean;
  createdAt: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  tier: "free" | "starter" | "pro" | "enterprise";
  totalTickets: number;
  openTickets: number;
  satisfactionScore: number;
  createdAt: string;
}

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock database
const MOCK_TICKETS: Ticket[] = [
  {
    id: 12847,
    subject: "Unable to export data to CSV",
    description: "I've been trying to export my analytics data to CSV for the past hour but keep getting a timeout error. This is urgent as I need it for tomorrow's board meeting.",
    status: "open",
    priority: "urgent",
    customerId: "cus_abc123",
    customerEmail: "sarah.chen@acmecorp.com",
    assigneeId: "agent_456",
    tags: ["export", "data", "timeout", "enterprise"],
    createdAt: "2025-09-30T14:23:00Z",
    updatedAt: "2025-09-30T14:45:00Z",
    comments: [
      {
        id: 1,
        ticketId: 12847,
        authorId: "cus_abc123",
        authorName: "Sarah Chen",
        body: "I've been trying to export my analytics data to CSV for the past hour but keep getting a timeout error.",
        isPublic: true,
        createdAt: "2025-09-30T14:23:00Z"
      },
      {
        id: 2,
        ticketId: 12847,
        authorId: "agent_456",
        authorName: "Support Agent Mike",
        body: "Hi Sarah, I'm looking into this now. Can you tell me approximately how many rows you're trying to export?",
        isPublic: true,
        createdAt: "2025-09-30T14:45:00Z"
      }
    ]
  },
  {
    id: 12848,
    subject: "Billing question about annual plan",
    description: "We're interested in upgrading to the enterprise annual plan. What's the discount compared to monthly?",
    status: "new",
    priority: "normal",
    customerId: "cus_xyz789",
    customerEmail: "john.doe@startup.io",
    assigneeId: null,
    tags: ["billing", "enterprise", "upgrade"],
    createdAt: "2025-09-30T15:12:00Z",
    updatedAt: "2025-09-30T15:12:00Z",
    comments: []
  }
];

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: "cus_abc123",
    name: "Sarah Chen",
    email: "sarah.chen@acmecorp.com",
    phone: "+1-555-0123",
    company: "Acme Corp",
    tier: "enterprise",
    totalTickets: 47,
    openTickets: 1,
    satisfactionScore: 4.8,
    createdAt: "2024-03-15T10:00:00Z"
  },
  {
    id: "cus_xyz789",
    name: "John Doe",
    email: "john.doe@startup.io",
    phone: "+1-555-0456",
    company: "Startup.io",
    tier: "pro",
    totalTickets: 8,
    openTickets: 1,
    satisfactionScore: 4.5,
    createdAt: "2025-01-20T09:30:00Z"
  }
];

/**
 * Get a ticket by ID
 */
export async function getTicket(args: { ticketId: number }): Promise<Ticket> {
  await delay(120); // Simulate API latency

  const ticket = MOCK_TICKETS.find(t => t.id === args.ticketId);
  if (!ticket) {
    throw new Error(`Ticket ${args.ticketId} not found`);
  }

  return ticket;
}

/**
 * Search tickets by status, priority, or customer
 */
export async function searchTickets(args: {
  status?: string;
  priority?: string;
  customerId?: string;
}): Promise<Ticket[]> {
  await delay(180);

  let results = [...MOCK_TICKETS];

  if (args.status) {
    results = results.filter(t => t.status === args.status);
  }
  if (args.priority) {
    results = results.filter(t => t.priority === args.priority);
  }
  if (args.customerId) {
    results = results.filter(t => t.customerId === args.customerId);
  }

  return results;
}

/**
 * Get customer information
 */
export async function getCustomer(args: { customerId: string }): Promise<Customer> {
  await delay(95);

  const customer = MOCK_CUSTOMERS.find(c => c.id === args.customerId);
  if (!customer) {
    throw new Error(`Customer ${args.customerId} not found`);
  }

  return customer;
}

/**
 * Add a comment to a ticket
 */
export async function addComment(args: {
  ticketId: number;
  authorId: string;
  authorName: string;
  body: string;
  isPublic: boolean;
}): Promise<TicketComment> {
  await delay(150);

  const ticket = MOCK_TICKETS.find(t => t.id === args.ticketId);
  if (!ticket) {
    throw new Error(`Ticket ${args.ticketId} not found`);
  }

  const comment: TicketComment = {
    id: ticket.comments.length + 1,
    ticketId: args.ticketId,
    authorId: args.authorId,
    authorName: args.authorName,
    body: args.body,
    isPublic: args.isPublic,
    createdAt: new Date().toISOString()
  };

  ticket.comments.push(comment);
  ticket.updatedAt = new Date().toISOString();

  return comment;
}

/**
 * Update ticket status and priority
 */
export async function updateTicket(args: {
  ticketId: number;
  status?: "new" | "open" | "pending" | "solved" | "closed";
  priority?: "low" | "normal" | "high" | "urgent";
  assigneeId?: string;
}): Promise<Ticket> {
  await delay(130);

  const ticket = MOCK_TICKETS.find(t => t.id === args.ticketId);
  if (!ticket) {
    throw new Error(`Ticket ${args.ticketId} not found`);
  }

  if (args.status) ticket.status = args.status;
  if (args.priority) ticket.priority = args.priority;
  if (args.assigneeId !== undefined) ticket.assigneeId = args.assigneeId;

  ticket.updatedAt = new Date().toISOString();

  return ticket;
}
