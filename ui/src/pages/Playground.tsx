import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScriptExecution } from "@/lib/hooks";
import { Play, Loader2, Check, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TEMPLATES = {
  basic: {
    name: "Basic RPC Call",
    code: `// Make a simple RPC call
const result = await rpc.slack.listChannels({});
console.log("Channels:", result);`,
  },
  parallel: {
    name: "Parallel Calls",
    code: `// Execute multiple RPC calls in parallel
const [channels, customer] = await Promise.all([
  rpc.slack.listChannels({}),
  rpc.stripe.getCustomer({ customerId: "cus_123" })
]);

console.log("Channels:", channels);
console.log("Customer:", customer);`,
  },
  errorHandling: {
    name: "Error Handling",
    code: `// Handle errors gracefully
try {
  const result = await rpc.slack.getChannel({ channelId: "C123" });
  console.log("Success:", result);
} catch (error) {
  console.error("Error:", error.message);
}`,
  },
  dataProcessing: {
    name: "Data Processing",
    code: `// Fetch data and process it
const channels = await rpc.slack.listChannels({});

const activeChannels = channels.filter(ch => !ch.is_archived);
console.log(\`Found \${activeChannels.length} active channels\`);

activeChannels.forEach(ch => {
  console.log(\`- \${ch.name}: \${ch.num_members} members\`);
});`,
  },
};

export default function Playground() {
  const [code, setCode] = useState(TEMPLATES.basic.code);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("basic");
  const executeScript = useScriptExecution();

  const handleTemplateChange = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    const template = TEMPLATES[templateKey as keyof typeof TEMPLATES];
    if (template) {
      setCode(template.code);
    }
  };

  const handleExecute = () => {
    executeScript.mutate({ script: code });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Playground</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Execute TypeScript code with RPC functions
        </p>
      </div>

      {/* Template Selector and Execute Button */}
      <div className="flex flex-col md:flex-row gap-4">
        <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
          <SelectTrigger className="w-full md:w-[250px]">
            <SelectValue placeholder="Select template" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TEMPLATES).map(([key, template]) => (
              <SelectItem key={key} value={key}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={handleExecute}
          disabled={executeScript.isPending || !code.trim()}
          className="w-full md:w-auto"
        >
          {executeScript.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Execute
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Code Editor */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Code Editor</CardTitle>
            <CardDescription>Write TypeScript code using the `rpc` client</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
              <Editor
                height="500px"
                defaultLanguage="typescript"
                theme="vs-dark"
                value={code}
                onChange={(value) => setCode(value || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>Output from your script execution</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="output" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="output">Output</TabsTrigger>
                <TabsTrigger value="info">Info</TabsTrigger>
              </TabsList>
              <TabsContent value="output" className="mt-4">
                {executeScript.isPending ? (
                  <div className="flex items-center justify-center h-[450px] text-slate-600 dark:text-slate-400">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p>Executing script...</p>
                    </div>
                  </div>
                ) : executeScript.isError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="mt-2">
                      <div className="font-semibold mb-2">Execution Error</div>
                      <pre className="text-xs overflow-auto max-h-[400px] bg-red-50 dark:bg-red-900/10 p-3 rounded">
                        {executeScript.error instanceof Error
                          ? executeScript.error.message
                          : String(executeScript.error)}
                      </pre>
                    </AlertDescription>
                  </Alert>
                ) : executeScript.isSuccess ? (
                  <Alert className="border-green-200 dark:border-green-900">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="mt-2">
                      <div className="font-semibold mb-2 text-green-900 dark:text-green-100">
                        Execution Successful
                      </div>
                      <pre className="text-xs overflow-auto max-h-[400px] bg-slate-100 dark:bg-slate-800 p-3 rounded font-mono">
                        {executeScript.data?.result || "(No output)"}
                      </pre>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex items-center justify-center h-[450px] text-slate-600 dark:text-slate-400">
                    <div className="text-center">
                      <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Click Execute to run your script</p>
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="info" className="mt-4">
                <div className="space-y-4">
                  {executeScript.data?.execution && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Execution Time:</span>
                        <span className="font-mono">{executeScript.data.execution.duration}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Status:</span>
                        <span
                          className={
                            executeScript.data.execution.success
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {executeScript.data.execution.success ? "Success" : "Error"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Timestamp:</span>
                        <span className="font-mono text-xs">
                          {new Date(executeScript.data.execution.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                  <Alert>
                    <AlertDescription className="text-xs">
                      <div className="font-semibold mb-2">Available Features:</div>
                      <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                        <li>Use <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">rpc.namespace.function()</code> to call RPC functions</li>
                        <li>Use <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">console.log()</code> to output results</li>
                        <li>Top-level <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">await</code> is supported</li>
                        <li>Scripts timeout after 10 seconds</li>
                        <li>All executions are saved to history</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
