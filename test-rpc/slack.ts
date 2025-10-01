// Slack-like team messaging API

interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
  topic: string;
  purpose: string;
  memberCount: number;
  createdAt: number;
}

interface Message {
  id: string;
  channelId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: string;
  threadTs?: string; // Thread parent timestamp
  reactions: Reaction[];
  attachments: Attachment[];
}

interface Reaction {
  name: string; // emoji name
  count: number;
  users: string[];
}

interface Attachment {
  title: string;
  text?: string;
  color?: string;
  fields?: AttachmentField[];
}

interface AttachmentField {
  title: string;
  value: string;
  short: boolean;
}

interface User {
  id: string;
  name: string;
  realName: string;
  email: string;
  isBot: boolean;
  statusText: string;
  statusEmoji: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock data
const MOCK_CHANNELS: Channel[] = [
  {
    id: "C12345",
    name: "customer-support",
    isPrivate: false,
    topic: "Customer support team coordination",
    purpose: "Discuss and resolve customer issues",
    memberCount: 12,
    createdAt: 1640000000
  },
  {
    id: "C67890",
    name: "engineering",
    isPrivate: false,
    topic: "Engineering team discussions",
    purpose: "Technical discussions and bug tracking",
    memberCount: 25,
    createdAt: 1640000000
  },
  {
    id: "C11111",
    name: "urgent-issues",
    isPrivate: false,
    topic: "High priority customer escalations",
    purpose: "Track and resolve urgent customer issues",
    memberCount: 8,
    createdAt: 1650000000
  }
];

const MOCK_USERS: User[] = [
  {
    id: "U123",
    name: "support.bot",
    realName: "Support Bot",
    email: "bot@company.com",
    isBot: true,
    statusText: "Online",
    statusEmoji: ":robot_face:"
  },
  {
    id: "U456",
    name: "mike.support",
    realName: "Mike Johnson",
    email: "mike@company.com",
    isBot: false,
    statusText: "In a meeting",
    statusEmoji: ":calendar:"
  }
];

const MOCK_MESSAGES: Message[] = [];

/**
 * Send a message to a channel
 */
export async function sendMessage(args: {
  channelId: string;
  text: string;
  username?: string;
  attachments?: Attachment[];
}): Promise<Message> {
  await delay(95);

  const channel = MOCK_CHANNELS.find(c => c.id === args.channelId);
  if (!channel) {
    throw new Error(`Channel ${args.channelId} not found`);
  }

  const message: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    channelId: args.channelId,
    userId: "U123",
    username: args.username || "Support Bot",
    text: args.text,
    timestamp: new Date().toISOString(),
    reactions: [],
    attachments: args.attachments || []
  };

  MOCK_MESSAGES.push(message);

  return message;
}

/**
 * Send a rich message with formatting and attachments
 */
export async function sendRichMessage(args: {
  channelId: string;
  title: string;
  text: string;
  color?: string;
  fields?: AttachmentField[];
}): Promise<Message> {
  await delay(110);

  const attachment: Attachment = {
    title: args.title,
    text: args.text,
    color: args.color || "#36a64f",
    fields: args.fields
  };

  return sendMessage({
    channelId: args.channelId,
    text: "",
    attachments: [attachment]
  });
}

/**
 * Send a notification about a customer ticket
 */
export async function notifyTicket(args: {
  channelId: string;
  ticketId: number;
  subject: string;
  priority: string;
  customerName: string;
  customerTier: string;
  assignee?: string;
}): Promise<Message> {
  await delay(120);

  const priorityColors: Record<string, string> = {
    urgent: "#dc2626",
    high: "#ea580c",
    normal: "#2563eb",
    low: "#64748b"
  };

  const fields: AttachmentField[] = [
    {
      title: "Customer",
      value: `${args.customerName} (${args.customerTier})`,
      short: true
    },
    {
      title: "Priority",
      value: args.priority.toUpperCase(),
      short: true
    }
  ];

  if (args.assignee) {
    fields.push({
      title: "Assigned To",
      value: args.assignee,
      short: true
    });
  }

  const text = args.assignee
    ? `<@${args.assignee}> New ${args.priority} priority ticket assigned`
    : `New ${args.priority} priority ticket needs assignment`;

  return sendRichMessage({
    channelId: args.channelId,
    title: `Ticket #${args.ticketId}: ${args.subject}`,
    text,
    color: priorityColors[args.priority] || priorityColors.normal,
    fields
  });
}

/**
 * Send a notification about an engineering issue
 */
export async function notifyIssue(args: {
  channelId: string;
  issueIdentifier: string;
  title: string;
  status: string;
  priority: string;
  assignee?: string;
  linkedTicket?: string;
}): Promise<Message> {
  await delay(105);

  const fields: AttachmentField[] = [
    {
      title: "Status",
      value: args.status,
      short: true
    },
    {
      title: "Priority",
      value: args.priority,
      short: true
    }
  ];

  if (args.assignee) {
    fields.push({
      title: "Assignee",
      value: args.assignee,
      short: true
    });
  }

  if (args.linkedTicket) {
    fields.push({
      title: "Linked Ticket",
      value: args.linkedTicket,
      short: true
    });
  }

  return sendRichMessage({
    channelId: args.channelId,
    title: `${args.issueIdentifier}: ${args.title}`,
    text: `Issue ${args.status}`,
    color: "#0091ff",
    fields
  });
}

/**
 * List channels
 */
export async function listChannels(args: { excludePrivate?: boolean }): Promise<Channel[]> {
  await delay(85);

  if (args.excludePrivate) {
    return MOCK_CHANNELS.filter(c => !c.isPrivate);
  }

  return MOCK_CHANNELS;
}

/**
 * Get channel info
 */
export async function getChannel(args: { channelId: string }): Promise<Channel> {
  await delay(70);

  const channel = MOCK_CHANNELS.find(c => c.id === args.channelId);
  if (!channel) {
    throw new Error(`Channel ${args.channelId} not found`);
  }

  return channel;
}

/**
 * Find channel by name
 */
export async function findChannel(args: { name: string }): Promise<Channel | null> {
  await delay(75);

  return MOCK_CHANNELS.find(c => c.name === args.name) || null;
}
