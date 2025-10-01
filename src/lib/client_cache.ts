// Singleton cache for generated RPC client code

interface ClientData {
  code: string;
  version: number;
}

class ClientCache {
  private static instance: ClientCache;
  private client: ClientData = { code: "", version: 0 };

  private constructor() {}

  static getInstance(): ClientCache {
    if (!ClientCache.instance) {
      ClientCache.instance = new ClientCache();
    }
    return ClientCache.instance;
  }

  set_client(code: string): void {
    this.client = {
      code,
      version: this.client.version + 1
    };
  }

  get_client(): ClientData {
    return this.client;
  }
}

export const clientCache = ClientCache.getInstance();
export const set_client = (code: string) => clientCache.set_client(code);
export const get_client = () => clientCache.get_client();
