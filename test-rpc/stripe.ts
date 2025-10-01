// Stripe-like payment and subscription API

interface Customer {
  id: string;
  email: string;
  name: string;
  description: string;
  created: number;
  balance: number;
  delinquent: boolean;
  defaultSource: string;
}

interface Subscription {
  id: string;
  customerId: string;
  status: "active" | "past_due" | "canceled" | "unpaid" | "trialing";
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  plan: Plan;
  quantity: number;
  metadata: Record<string, string>;
  created: number;
}

interface Plan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: "month" | "year";
  features: string[];
}

interface Charge {
  id: string;
  amount: number;
  currency: string;
  status: "succeeded" | "pending" | "failed";
  customerId: string;
  description: string;
  created: number;
  refunded: boolean;
}

interface Invoice {
  id: string;
  customerId: string;
  subscriptionId: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: "paid" | "open" | "void" | "uncollectible";
  dueDate: number;
  created: number;
  lineItems: LineItem[];
}

interface LineItem {
  description: string;
  amount: number;
  quantity: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock data
const MOCK_CUSTOMERS: Customer[] = [
  {
    id: "cus_abc123",
    email: "sarah.chen@acmecorp.com",
    name: "Sarah Chen",
    description: "Enterprise customer - Acme Corp",
    created: 1710504000,
    balance: 0,
    delinquent: false,
    defaultSource: "card_xyz789"
  }
];

const MOCK_PLANS: Plan[] = [
  {
    id: "plan_enterprise_monthly",
    name: "Enterprise Monthly",
    amount: 49900,
    currency: "usd",
    interval: "month",
    features: ["Unlimited users", "Advanced analytics", "Priority support", "Custom integrations"]
  },
  {
    id: "plan_pro_monthly",
    name: "Pro Monthly",
    amount: 9900,
    currency: "usd",
    interval: "month",
    features: ["Up to 10 users", "Standard analytics", "Email support"]
  }
];

const MOCK_SUBSCRIPTIONS: Subscription[] = [
  {
    id: "sub_enterprise_456",
    customerId: "cus_abc123",
    status: "active",
    currentPeriodStart: 1727740800,
    currentPeriodEnd: 1730419200,
    cancelAtPeriodEnd: false,
    plan: MOCK_PLANS[0],
    quantity: 25,
    metadata: { "company": "Acme Corp", "department": "Engineering" },
    created: 1710504000
  }
];

const MOCK_INVOICES: Invoice[] = [
  {
    id: "in_latest_001",
    customerId: "cus_abc123",
    subscriptionId: "sub_enterprise_456",
    amountDue: 124750,
    amountPaid: 124750,
    currency: "usd",
    status: "paid",
    dueDate: 1727740800,
    created: 1727654400,
    lineItems: [
      {
        description: "Enterprise Monthly × 25 users",
        amount: 124750,
        quantity: 25
      }
    ]
  },
  {
    id: "in_previous_002",
    customerId: "cus_abc123",
    subscriptionId: "sub_enterprise_456",
    amountDue: 99800,
    amountPaid: 99800,
    currency: "usd",
    status: "paid",
    dueDate: 1725148800,
    created: 1725062400,
    lineItems: [
      {
        description: "Enterprise Monthly × 20 users",
        amount: 99800,
        quantity: 20
      }
    ]
  }
];

const MOCK_CHARGES: Charge[] = [
  {
    id: "ch_latest_123",
    amount: 124750,
    currency: "usd",
    status: "succeeded",
    customerId: "cus_abc123",
    description: "Subscription payment for in_latest_001",
    created: 1727740800,
    refunded: false
  }
];

/**
 * Get customer by ID
 */
export async function getCustomer(args: { customerId: string }): Promise<Customer> {
  await delay(110);

  const customer = MOCK_CUSTOMERS.find(c => c.id === args.customerId);
  if (!customer) {
    throw new Error(`Customer ${args.customerId} not found`);
  }

  return customer;
}

/**
 * Get subscription details
 */
export async function getSubscription(args: { subscriptionId: string }): Promise<Subscription> {
  await delay(125);

  const subscription = MOCK_SUBSCRIPTIONS.find(s => s.id === args.subscriptionId);
  if (!subscription) {
    throw new Error(`Subscription ${args.subscriptionId} not found`);
  }

  return subscription;
}

/**
 * List customer subscriptions
 */
export async function listSubscriptions(args: { customerId: string }): Promise<Subscription[]> {
  await delay(145);

  return MOCK_SUBSCRIPTIONS.filter(s => s.customerId === args.customerId);
}

/**
 * Get recent invoices for a customer
 */
export async function listInvoices(args: {
  customerId: string;
  limit?: number;
}): Promise<Invoice[]> {
  await delay(160);

  const invoices = MOCK_INVOICES
    .filter(i => i.customerId === args.customerId)
    .sort((a, b) => b.created - a.created);

  return args.limit ? invoices.slice(0, args.limit) : invoices;
}

/**
 * Get recent charges for a customer
 */
export async function listCharges(args: {
  customerId: string;
  limit?: number;
}): Promise<Charge[]> {
  await delay(135);

  const charges = MOCK_CHARGES
    .filter(c => c.customerId === args.customerId)
    .sort((a, b) => b.created - a.created);

  return args.limit ? charges.slice(0, args.limit) : charges;
}

/**
 * Check if customer has payment issues
 */
export async function checkPaymentHealth(args: { customerId: string }): Promise<{
  healthy: boolean;
  issues: string[];
  subscriptionStatus: string;
  outstandingBalance: number;
}> {
  await delay(95);

  const customer = MOCK_CUSTOMERS.find(c => c.id === args.customerId);
  if (!customer) {
    throw new Error(`Customer ${args.customerId} not found`);
  }

  const subscriptions = MOCK_SUBSCRIPTIONS.filter(s => s.customerId === args.customerId);
  const issues: string[] = [];

  if (customer.delinquent) {
    issues.push("Customer marked as delinquent");
  }

  const pastDueSub = subscriptions.find(s => s.status === "past_due");
  if (pastDueSub) {
    issues.push("Past due subscription found");
  }

  if (customer.balance < 0) {
    issues.push(`Outstanding balance: $${Math.abs(customer.balance) / 100}`);
  }

  return {
    healthy: issues.length === 0,
    issues,
    subscriptionStatus: subscriptions[0]?.status || "none",
    outstandingBalance: customer.balance
  };
}
