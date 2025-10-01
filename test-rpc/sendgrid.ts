// SendGrid-like email API

interface EmailAddress {
  email: string;
  name?: string;
}

interface Email {
  id: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  attachments?: Attachment[];
  sendAt?: number; // Unix timestamp for scheduled send
  status: "queued" | "sent" | "delivered" | "bounced" | "failed";
  createdAt: string;
  sentAt?: string;
}

interface Attachment {
  content: string; // base64 encoded
  filename: string;
  type: string;
  disposition: "attachment" | "inline";
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  variables: string[];
}

interface SendResult {
  success: boolean;
  emailId: string;
  message: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock data
const MOCK_TEMPLATES: EmailTemplate[] = [
  {
    id: "tmpl_ticket_response",
    name: "Ticket Response",
    subject: "Re: {{ticket_subject}}",
    htmlContent: `
      <html>
        <body>
          <p>Hi {{customer_name}},</p>
          <p>{{response_body}}</p>
          <p>{{agent_signature}}</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Ticket #{{ticket_id}} | {{company_name}} Support
          </p>
        </body>
      </html>
    `,
    variables: ["customer_name", "ticket_subject", "response_body", "agent_signature", "ticket_id", "company_name"]
  },
  {
    id: "tmpl_issue_update",
    name: "Issue Status Update",
    subject: "Update on your reported issue",
    htmlContent: `
      <html>
        <body>
          <p>Hi {{customer_name}},</p>
          <p>We wanted to update you on the issue you reported:</p>
          <p><strong>{{issue_title}}</strong></p>
          <p>{{update_message}}</p>
          <p>Current Status: <span style="color: #0091ff;">{{status}}</span></p>
          <p>{{closing_message}}</p>
          <p>Best regards,<br>{{agent_name}}</p>
        </body>
      </html>
    `,
    variables: ["customer_name", "issue_title", "update_message", "status", "closing_message", "agent_name"]
  }
];

const MOCK_EMAILS: Email[] = [];

/**
 * Send a simple text/HTML email
 */
export async function sendEmail(args: {
  to: EmailAddress[];
  subject: string;
  text?: string;
  html?: string;
  from?: EmailAddress;
  cc?: EmailAddress[];
  attachments?: Attachment[];
}): Promise<SendResult> {
  await delay(180);

  const email: Email = {
    id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    from: args.from || { email: "support@company.com", name: "Customer Support" },
    to: args.to,
    cc: args.cc,
    subject: args.subject,
    text: args.text,
    html: args.html,
    attachments: args.attachments,
    status: "sent",
    createdAt: new Date().toISOString(),
    sentAt: new Date().toISOString()
  };

  MOCK_EMAILS.push(email);

  return {
    success: true,
    emailId: email.id,
    message: "Email sent successfully"
  };
}

/**
 * Send email using a template
 */
export async function sendTemplateEmail(args: {
  to: EmailAddress[];
  templateId: string;
  dynamicTemplateData: Record<string, any>;
  from?: EmailAddress;
  cc?: EmailAddress[];
}): Promise<SendResult> {
  await delay(195);

  const template = MOCK_TEMPLATES.find(t => t.id === args.templateId);
  if (!template) {
    throw new Error(`Template ${args.templateId} not found`);
  }

  // Replace template variables
  let subject = template.subject;
  for (const [key, value] of Object.entries(args.dynamicTemplateData)) {
    subject = subject.replace(`{{${key}}}`, String(value));
  }

  const email: Email = {
    id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    from: args.from || { email: "support@company.com", name: "Customer Support" },
    to: args.to,
    cc: args.cc,
    subject,
    templateId: args.templateId,
    dynamicTemplateData: args.dynamicTemplateData,
    status: "sent",
    createdAt: new Date().toISOString(),
    sentAt: new Date().toISOString()
  };

  MOCK_EMAILS.push(email);

  return {
    success: true,
    emailId: email.id,
    message: "Template email sent successfully"
  };
}

/**
 * Send ticket response email
 */
export async function sendTicketResponse(args: {
  customerEmail: string;
  customerName: string;
  ticketId: number;
  ticketSubject: string;
  responseBody: string;
  agentName: string;
  agentEmail?: string;
}): Promise<SendResult> {
  await delay(170);

  return sendTemplateEmail({
    to: [{ email: args.customerEmail, name: args.customerName }],
    templateId: "tmpl_ticket_response",
    from: {
      email: args.agentEmail || "support@company.com",
      name: args.agentName
    },
    dynamicTemplateData: {
      customer_name: args.customerName,
      ticket_subject: args.ticketSubject,
      response_body: args.responseBody,
      agent_signature: args.agentName,
      ticket_id: args.ticketId,
      company_name: "Your Company"
    }
  });
}

/**
 * Send issue status update email
 */
export async function sendIssueUpdate(args: {
  customerEmail: string;
  customerName: string;
  issueTitle: string;
  updateMessage: string;
  status: string;
  agentName: string;
}): Promise<SendResult> {
  await delay(165);

  return sendTemplateEmail({
    to: [{ email: args.customerEmail, name: args.customerName }],
    templateId: "tmpl_issue_update",
    dynamicTemplateData: {
      customer_name: args.customerName,
      issue_title: args.issueTitle,
      update_message: args.updateMessage,
      status: args.status,
      closing_message: "We'll keep you posted on any further developments.",
      agent_name: args.agentName
    }
  });
}

/**
 * List available templates
 */
export async function listTemplates(args: {}): Promise<EmailTemplate[]> {
  await delay(90);
  return MOCK_TEMPLATES;
}

/**
 * Get template by ID
 */
export async function getTemplate(args: { templateId: string }): Promise<EmailTemplate> {
  await delay(75);

  const template = MOCK_TEMPLATES.find(t => t.id === args.templateId);
  if (!template) {
    throw new Error(`Template ${args.templateId} not found`);
  }

  return template;
}

/**
 * Get email status
 */
export async function getEmailStatus(args: { emailId: string }): Promise<Email> {
  await delay(80);

  const email = MOCK_EMAILS.find(e => e.id === args.emailId);
  if (!email) {
    throw new Error(`Email ${args.emailId} not found`);
  }

  return email;
}
