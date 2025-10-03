import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Explorer from "./pages/Explorer";
import Playground from "./pages/Playground";
import History from "./pages/History";
import Types from "./pages/Types";
import Settings from "./pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/ui" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="explorer" element={<Explorer />} />
          <Route path="playground" element={<Playground />} />
          <Route path="history" element={<History />} />
          <Route path="types" element={<Types />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
