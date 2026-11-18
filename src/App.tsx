/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import DashboardLayout from "./components/DashboardLayout";
import DashboardOverview from "./components/DashboardOverview";
import CustomCommands from "./components/CustomCommands";
import CommandPermissions from "./components/CommandPermissions";
import GuildSelection from "./components/GuildSelection";
import Moderation from "./components/Moderation";
import Settings from "./components/Settings";
import Login from "./components/Login";
import AuthCallback from "./components/AuthCallback";

import Levels from "./components/Levels";

import Tickets from "./components/Tickets";
import Welcome from "./components/Welcome";
import RolePanels from "./components/RolePanels";
import Logging from "./components/Logging";
import Store from "./components/Store";
import AISupport from "./components/AISupport";
import ServerArchitect from "./components/ServerArchitect";
import EmbedCreator from "./components/EmbedCreator";
import DynamicVoice from "./components/DynamicVoice";
import Analytics from "./components/Analytics";
import Leaderboard from "./components/Leaderboard";
import AdvancedSecurity from "./components/AdvancedSecurity";
import Billing from "./components/Billing";
import BillingSuccess from "./components/BillingSuccess";
import BillingCancel from "./components/BillingCancel";
import RestoreAudit from "./components/RestoreAudit";
import { Toaster } from "sonner";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/billing/success" element={<BillingSuccess />} />
        <Route path="/billing/cancel" element={<BillingCancel />} />
        <Route path="/servers" element={<GuildSelection />} />
        <Route path="/dashboard/:guildId" element={<DashboardLayout />}>
          <Route index element={<DashboardOverview />} />
          <Route path="moderation" element={<Moderation />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="welcome" element={<Welcome />} />
          <Route path="role-panels" element={<RolePanels />} />
          <Route path="logging" element={<Logging />} />
          <Route path="store" element={<Store />} />
          <Route path="ai" element={<AISupport />} />
          <Route path="architect" element={<ServerArchitect />} />
          <Route path="levels" element={<Levels />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="voice" element={<DynamicVoice />} />
          <Route path="commands" element={<CustomCommands />} />
          <Route path="permissions" element={<CommandPermissions />} />
          <Route path="embeds" element={<EmbedCreator />} />
          <Route path="settings" element={<Settings />} />
          <Route path="security" element={<AdvancedSecurity />} />
          <Route path="billing" element={<Billing />} />
          <Route path="restore-audit" element={<RestoreAudit />} />
        </Route>
      </Routes>
      <Toaster theme="dark" position="top-right" richColors />
    </Router>
  );
}




