import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Settings as SettingsStorage, type UserSettings } from "@/lib/storage";
import { Sun, Moon, Monitor } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  const [settings, setSettings] = useState<UserSettings>(SettingsStorage.get());

  useEffect(() => {
    // Apply theme to document
    const root = window.document.documentElement;
    if (settings.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [settings.theme]);

  const handleThemeChange = (theme: "light" | "dark") => {
    const newSettings = { ...settings, theme };
    setSettings(newSettings);
    SettingsStorage.set(newSettings);
  };

  const handleEditorFontSizeChange = (fontSize: string) => {
    const newSettings = {
      ...settings,
      editor: { ...settings.editor, fontSize: parseInt(fontSize) },
    };
    setSettings(newSettings);
    SettingsStorage.set(newSettings);
  };

  const handleEditorThemeChange = (theme: string) => {
    const newSettings = {
      ...settings,
      editor: { ...settings.editor, theme },
    };
    setSettings(newSettings);
    SettingsStorage.set(newSettings);
  };

  const handleMinimapToggle = () => {
    const newSettings = {
      ...settings,
      editor: { ...settings.editor, minimap: !settings.editor.minimap },
    };
    setSettings(newSettings);
    SettingsStorage.set(newSettings);
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset all settings to defaults?")) {
      SettingsStorage.reset();
      setSettings(SettingsStorage.get());
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Configure your UI preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize the look and feel of the UI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Theme</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={settings.theme === "light" ? "default" : "outline"}
                  onClick={() => handleThemeChange("light")}
                  className="w-full"
                >
                  <Sun className="h-4 w-4 mr-2" />
                  Light
                </Button>
                <Button
                  variant={settings.theme === "dark" ? "default" : "outline"}
                  onClick={() => handleThemeChange("dark")}
                  className="w-full"
                >
                  <Moon className="h-4 w-4 mr-2" />
                  Dark
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Code Editor Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Code Editor</CardTitle>
            <CardDescription>Configure Monaco Editor preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Font Size</Label>
              <Select
                value={settings.editor.fontSize.toString()}
                onValueChange={handleEditorFontSizeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12px (Small)</SelectItem>
                  <SelectItem value="14">14px (Medium)</SelectItem>
                  <SelectItem value="16">16px (Large)</SelectItem>
                  <SelectItem value="18">18px (Extra Large)</SelectItem>
                  <SelectItem value="20">20px (Huge)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Editor Theme</Label>
              <Select
                value={settings.editor.theme}
                onValueChange={handleEditorThemeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vs-dark">Dark</SelectItem>
                  <SelectItem value="vs-light">Light</SelectItem>
                  <SelectItem value="hc-black">High Contrast</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Minimap</Label>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Show code overview in editor
                  </p>
                </div>
                <Button
                  variant={settings.editor.minimap ? "default" : "outline"}
                  size="sm"
                  onClick={handleMinimapToggle}
                >
                  {settings.editor.minimap ? "Enabled" : "Disabled"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Settings Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Current Settings</CardTitle>
          <CardDescription>Preview of your current configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Theme:</span>
              <span className="font-mono capitalize">{settings.theme}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Editor Font Size:</span>
              <span className="font-mono">{settings.editor.fontSize}px</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Editor Theme:</span>
              <span className="font-mono">{settings.editor.theme}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Minimap:</span>
              <span className="font-mono">{settings.editor.minimap ? "Enabled" : "Disabled"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reset Button */}
      <div className="flex justify-end">
        <Button variant="destructive" onClick={handleReset}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
