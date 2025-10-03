import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScriptHistory, type ScriptExecution } from "@/lib/storage";
import { Trash2, Eye, Download, Check, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function History() {
  const [history, setHistory] = useState<ScriptExecution[]>(ScriptHistory.getAll());
  const [selectedExecution, setSelectedExecution] = useState<ScriptExecution | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredHistory = useMemo(() => {
    if (filterStatus === "all") return history;
    if (filterStatus === "success") return history.filter((h) => h.success);
    if (filterStatus === "error") return history.filter((h) => !h.success);
    return history;
  }, [history, filterStatus]);

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear all history?")) {
      ScriptHistory.clear();
      setHistory([]);
    }
  };

  const handleExportHistory = () => {
    const json = ScriptHistory.export();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `script-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const truncateScript = (script: string, maxLength: number = 50) => {
    if (script.length <= maxLength) return script;
    return script.substring(0, maxLength) + "...";
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Script History</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            View your executed scripts and results
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportHistory} disabled={history.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="destructive"
            onClick={handleClearHistory}
            disabled={history.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Executions</SelectItem>
            <SelectItem value="success">Success Only</SelectItem>
            <SelectItem value="error">Errors Only</SelectItem>
          </SelectContent>
        </Select>
        <Alert className="flex-1">
          <AlertDescription>
            Showing {filteredHistory.length} of {history.length} executions
          </AlertDescription>
        </Alert>
      </div>

      {/* History Table */}
      {history.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-slate-600 dark:text-slate-400">
            No script executions yet. Try running some code in the Playground!
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Execution History</CardTitle>
            <CardDescription>Click on a row to view details</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Script Preview</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((execution) => (
                  <TableRow
                    key={execution.id}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={() => setSelectedExecution(execution)}
                  >
                    <TableCell className="font-mono text-xs">
                      {formatDate(execution.timestamp)}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                        {truncateScript(execution.script)}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={execution.success ? "default" : "destructive"}
                        className={
                          execution.success
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                            : ""
                        }
                      >
                        {execution.success ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Success
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3 mr-1" />
                            Error
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{execution.duration}ms</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedExecution(execution);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Execution Detail Dialog */}
      <Dialog open={!!selectedExecution} onOpenChange={() => setSelectedExecution(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execution Details</DialogTitle>
            <DialogDescription>
              {selectedExecution && formatDate(selectedExecution.timestamp)}
            </DialogDescription>
          </DialogHeader>
          {selectedExecution && (
            <div className="space-y-4">
              {/* Status and Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Status:</span>
                  <Badge
                    variant={selectedExecution.success ? "default" : "destructive"}
                    className={
                      selectedExecution.success
                        ? "ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                        : "ml-2"
                    }
                  >
                    {selectedExecution.success ? "Success" : "Error"}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Duration:</span>
                  <span className="ml-2 font-mono">{selectedExecution.duration}ms</span>
                </div>
              </div>

              {/* Script */}
              <div>
                <h3 className="font-semibold mb-2">Script</h3>
                <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded overflow-x-auto">
                  {selectedExecution.script}
                </pre>
              </div>

              {/* Result or Error */}
              {selectedExecution.success ? (
                <div>
                  <h3 className="font-semibold mb-2">Result</h3>
                  <pre className="text-xs bg-green-50 dark:bg-green-900/10 p-4 rounded overflow-x-auto border border-green-200 dark:border-green-900">
                    {selectedExecution.result || "(No output)"}
                  </pre>
                </div>
              ) : (
                <div>
                  <h3 className="font-semibold mb-2">Error</h3>
                  <pre className="text-xs bg-red-50 dark:bg-red-900/10 p-4 rounded overflow-x-auto border border-red-200 dark:border-red-900">
                    {selectedExecution.error || "Unknown error"}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
