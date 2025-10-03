import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRpcMetadata, useNamespaces, useAvailableFunctions } from "@/lib/hooks";
import { Search, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ParsedFunction {
  namespace: string;
  name: string;
  fullName: string;
  signature: string;
  type: "rpc" | "mcp";
}

/**
 * Parse RPC metadata into structured function data
 */
function parseMetadata(metadata: string): ParsedFunction[] {
  const functions: ParsedFunction[] = [];

  // Split by double newline to get namespace blocks
  const blocks = metadata.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");

    // Look for namespace headers (e.g., "Namespace: slack" or "# slack")
    const namespaceMatch = lines[0]?.match(/(?:Namespace|#)\s*:\s*(\w+)/i);
    const namespace = namespaceMatch ? namespaceMatch[1] : "unknown";

    // Extract function signatures (lines that look like function declarations)
    for (const line of lines) {
      const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\((.*?)\)\s*:\s*(.+)|(\w+)\((.*?)\)\s*:\s*(.+)/);
      if (funcMatch) {
        const funcName = funcMatch[1] || funcMatch[4];
        const params = funcMatch[2] || funcMatch[5];
        const returnType = funcMatch[3] || funcMatch[6];

        functions.push({
          namespace,
          name: funcName,
          fullName: `${namespace}.${funcName}`,
          signature: `${funcName}(${params}): ${returnType}`,
          type: "rpc",
        });
      }
    }
  }

  return functions;
}

export default function Explorer() {
  const { data: metadataText, isLoading: metadataLoading } = useRpcMetadata();
  const { data: namespaces } = useNamespaces();
  const availableFunctions = useAvailableFunctions();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNamespace, setSelectedNamespace] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Parse metadata into structured data
  const parsedFunctions = useMemo(() => {
    if (!metadataText) return [];
    return parseMetadata(metadataText);
  }, [metadataText]);

  // Combine parsed functions with available functions from WebSocket
  const allFunctions = useMemo(() => {
    const functionMap = new Map<string, ParsedFunction>();

    // Add parsed functions
    parsedFunctions.forEach((fn) => {
      functionMap.set(fn.fullName, fn);
    });

    // Add any functions from WebSocket that aren't already in the map
    availableFunctions.forEach((fullName) => {
      if (!functionMap.has(fullName)) {
        const [namespace, name] = fullName.split(".");
        functionMap.set(fullName, {
          namespace: namespace || "unknown",
          name: name || fullName,
          fullName,
          signature: `${name}(...)`,
          type: fullName.startsWith("mcp_") ? "mcp" : "rpc",
        });
      }
    });

    return Array.from(functionMap.values());
  }, [parsedFunctions, availableFunctions]);

  // Filter functions based on search and namespace
  const filteredFunctions = useMemo(() => {
    return allFunctions.filter((fn) => {
      const matchesSearch =
        searchQuery === "" ||
        fn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fn.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fn.signature.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesNamespace =
        selectedNamespace === "all" || fn.namespace === selectedNamespace;

      return matchesSearch && matchesNamespace;
    });
  }, [allFunctions, searchQuery, selectedNamespace]);

  // Get unique namespaces for filter
  const uniqueNamespaces = useMemo(() => {
    const nsSet = new Set<string>();
    allFunctions.forEach((fn) => nsSet.add(fn.namespace));
    return Array.from(nsSet).sort();
  }, [allFunctions]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Function Explorer</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Browse and search all available RPC functions
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search functions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Filter by namespace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Namespaces</SelectItem>
            {uniqueNamespaces.map((ns) => (
              <SelectItem key={ns} value={ns}>
                {ns}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <Alert>
        <AlertDescription>
          Showing {filteredFunctions.length} of {allFunctions.length} functions
          {selectedNamespace !== "all" && ` in ${selectedNamespace} namespace`}
        </AlertDescription>
      </Alert>

      {/* Function Cards */}
      {metadataLoading ? (
        <div className="text-center text-slate-600 dark:text-slate-400 py-12">
          Loading functions...
        </div>
      ) : filteredFunctions.length === 0 ? (
        <div className="text-center text-slate-600 dark:text-slate-400 py-12">
          No functions found matching your search
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredFunctions.map((fn) => (
            <Card key={fn.fullName}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-mono">{fn.name}</CardTitle>
                    <CardDescription className="mt-1">
                      <Badge
                        variant="outline"
                        className={
                          fn.type === "rpc"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                            : "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
                        }
                      >
                        {fn.namespace}
                      </Badge>
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(fn.fullName, fn.fullName)}
                    className="ml-2"
                  >
                    {copiedId === fn.fullName ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Signature</p>
                    <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded block overflow-x-auto">
                      {fn.signature}
                    </code>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(fn.fullName, `${fn.fullName}-full`)}
                    >
                      {copiedId === `${fn.fullName}-full` ? (
                        <>
                          <Check className="h-3 w-3 mr-1 text-green-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Name
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(fn.signature, `${fn.fullName}-sig`)}
                    >
                      {copiedId === `${fn.fullName}-sig` ? (
                        <>
                          <Check className="h-3 w-3 mr-1 text-green-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Signature
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
