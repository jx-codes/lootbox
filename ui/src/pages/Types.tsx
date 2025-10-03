import { useState, useMemo } from "react";
import Editor from "@monaco-editor/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTypes, useNamespaceTypes, useClientCode, useNamespaces } from "@/lib/hooks";
import { Copy, Download, Check } from "lucide-react";

export default function Types() {
  const { data: allTypes, isLoading: allTypesLoading } = useTypes();
  const { data: clientCode, isLoading: clientLoading } = useClientCode();
  const { data: namespacesData } = useNamespaces();
  const [selectedNamespaces, setSelectedNamespaces] = useState<string[]>([]);
  const { data: filteredTypes } = useNamespaceTypes(selectedNamespaces);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const namespaces = useMemo(() => {
    return namespacesData?.namespaces.map((ns) => ns.name) || [];
  }, [namespacesData]);

  const handleCopy = (text: string, item: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(item);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleNamespace = (namespace: string) => {
    setSelectedNamespaces((prev) => {
      if (prev.includes(namespace)) {
        return prev.filter((ns) => ns !== namespace);
      } else {
        return [...prev, namespace];
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Type Explorer</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Browse TypeScript type definitions
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Types</TabsTrigger>
          <TabsTrigger value="filtered">Filtered Types</TabsTrigger>
          <TabsTrigger value="client">Client Code</TabsTrigger>
        </TabsList>

        {/* All Types Tab */}
        <TabsContent value="all" className="mt-6 space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => allTypes && handleCopy(allTypes, "all-types")}
              disabled={!allTypes}
            >
              {copiedItem === "all-types" ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => allTypes && handleDownload(allTypes, "types.ts")}
              disabled={!allTypes}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>All TypeScript Types</CardTitle>
              <CardDescription>Complete type definitions for all namespaces</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                {allTypesLoading ? (
                  <div className="flex items-center justify-center h-[600px] text-slate-600 dark:text-slate-400">
                    Loading types...
                  </div>
                ) : (
                  <Editor
                    height="600px"
                    defaultLanguage="typescript"
                    theme="vs-dark"
                    value={allTypes || "// No types available"}
                    options={{
                      readOnly: true,
                      minimap: { enabled: true },
                      fontSize: 14,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Filtered Types Tab */}
        <TabsContent value="filtered" className="mt-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select
                value={selectedNamespaces[0] || ""}
                onValueChange={(value) => setSelectedNamespaces([value])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select namespace to filter" />
                </SelectTrigger>
                <SelectContent>
                  {namespaces.map((ns) => (
                    <SelectItem key={ns} value={ns}>
                      {ns}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  filteredTypes && handleCopy(filteredTypes, "filtered-types")
                }
                disabled={!filteredTypes || selectedNamespaces.length === 0}
              >
                {copiedItem === "filtered-types" ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  filteredTypes &&
                  handleDownload(filteredTypes, `types-${selectedNamespaces.join("-")}.ts`)
                }
                disabled={!filteredTypes || selectedNamespaces.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Filtered TypeScript Types</CardTitle>
              <CardDescription>
                Type definitions for selected namespaces
                {selectedNamespaces.length > 0 && `: ${selectedNamespaces.join(", ")}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                {selectedNamespaces.length === 0 ? (
                  <div className="flex items-center justify-center h-[600px] text-slate-600 dark:text-slate-400">
                    Select a namespace to view its types
                  </div>
                ) : (
                  <Editor
                    height="600px"
                    defaultLanguage="typescript"
                    theme="vs-dark"
                    value={filteredTypes || "// Loading..."}
                    options={{
                      readOnly: true,
                      minimap: { enabled: true },
                      fontSize: 14,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Client Code Tab */}
        <TabsContent value="client" className="mt-6 space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => clientCode && handleCopy(clientCode, "client-code")}
              disabled={!clientCode}
            >
              {copiedItem === "client-code" ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => clientCode && handleDownload(clientCode, "client.ts")}
              disabled={!clientCode}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Generated Client Code</CardTitle>
              <CardDescription>Full RPC client implementation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                {clientLoading ? (
                  <div className="flex items-center justify-center h-[600px] text-slate-600 dark:text-slate-400">
                    Loading client code...
                  </div>
                ) : (
                  <Editor
                    height="600px"
                    defaultLanguage="typescript"
                    theme="vs-dark"
                    value={clientCode || "// No client code available"}
                    options={{
                      readOnly: true,
                      minimap: { enabled: true },
                      fontSize: 14,
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
