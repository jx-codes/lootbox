export async function query(args: {
  endpoint: string;
  query: string;
  variables?: Record<string, unknown>;
}) {
  const response = await fetch(args.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: args.query,
      variables: args.variables,
    }),
  });
  return response.json();
}

export function introspect(args: { endpoint: string }) {
  return query({
    endpoint: args.endpoint,
    query: `
        query IntrospectionQuery {
          __schema {
            types {
              name
              fields {
                name
                type { name kind ofType { name kind } }
              }
            }
          }
        }
      `,
  });
}
