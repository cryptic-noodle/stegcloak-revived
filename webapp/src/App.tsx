import { useState } from "react";
import {
  Lock,
  Unlock,
  Copy,
  Download,
  RefreshCw,
  Check,
  Eye,
  EyeOff,
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react";
import { useCryptoWorker } from "./hooks/useCryptoWorker";
import { detach, decodeBase6 } from "@stegcloak/core";
import * as C from "@stegcloak/core";

export default function App() {
  const { cloak, decloak } = useCryptoWorker();
  const [activeTab, setActiveTab] = useState<"cloak" | "uncloak">("cloak");

  // --- Cloak State ---
  const [cloakSecret, setCloakSecret] = useState("");
  const [cloakCover, setCloakCover] = useState("This is a cover text sentence to hide our message.");
  const [usePassword, setUsePassword] = useState(true);
  const [cloakPassword, setCloakPassword] = useState("");
  const [cloakStep, setCloakStep] = useState(1);
  const [cloakOutput, setCloakOutput] = useState("");
  const [cloakLoading, setCloakLoading] = useState(false);
  const [showCloakPass, setShowCloakPass] = useState(false);
  const [cloakCopied, setCloakCopied] = useState(false);

  // --- Uncloak State ---
  const [uncloakPayload, setUncloakPayload] = useState("");
  const [uncloakPassword, setUncloakPassword] = useState("");
  const [uncloakStep, setUncloakStep] = useState(1);
  const [isEncrypted, setIsEncrypted] = useState<boolean | null>(null);
  const [uncloakOutput, setUncloakOutput] = useState("");
  const [uncloakLoading, setUncloakLoading] = useState(false);
  const [showUncloakPass, setShowUncloakPass] = useState(false);
  const [uncloakCopied, setUncloakCopied] = useState(false);
  const [uncloakError, setUncloakError] = useState("");

  // Helpers
  const getZwcEstimate = (text: string) => {
    // Estimating compression and padding overhead roughly
    const len = new TextEncoder().encode(text).length;
    const paddingOffset = len < 20 ? len : Math.ceil(len * 0.5); // dummy rough compression estimate
    const rawPayloadSize = (usePassword ? 88 : 2) + Math.max(1, paddingOffset);
    const chunks = Math.ceil((rawPayloadSize + 4) / 8);
    return chunks * 25;
  };

  const handleCloakReset = () => {
    if (cloakOutput && !window.confirm("Start a new Cloak session? Your current result will be cleared.")) {
      return;
    }
    setCloakSecret("");
    setCloakCover("This is a cover text sentence to hide our message.");
    setUsePassword(true);
    setCloakPassword("");
    setCloakOutput("");
    setCloakStep(1);
  };

  const handleUncloakReset = () => {
    setUncloakPayload("");
    setUncloakPassword("");
    setUncloakOutput("");
    setIsEncrypted(null);
    setUncloakError("");
    setUncloakStep(1);
  };

  // Stepper execution
  const executeCloak = async () => {
    if (usePassword && !cloakPassword) {
      alert("Please enter an encryption password.");
      return;
    }
    if (cloakCover.split(" ").length < 2) {
      alert("Cover text must have at least two words.");
      return;
    }
    setCloakLoading(true);
    try {
      const result = await cloak(cloakSecret, cloakCover, usePassword ? cloakPassword : "");
      setCloakOutput(result);
      setCloakStep(4);
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setCloakLoading(false);
    }
  };

  const verifyUncloakPayload = () => {
    if (!uncloakPayload) {
      setUncloakError("Please paste a cloaked text payload.");
      return;
    }
    setUncloakError("");
    try {
      const detached = detach(uncloakPayload, C.ZWC);
      const decoded = decodeBase6(detached, C.ZWC);
      if (decoded.length < 2) {
        throw new Error("Payload is corrupted or has unsupported format.");
      }
      const version = decoded[0];
      if (version !== C.VERSION) {
        throw new Error(`Unsupported payload version: v${version}`);
      }
      const flags = decoded[1];
      const encrypted = (flags & C.FLAG_ENCRYPTED) !== 0;
      setIsEncrypted(encrypted);

      if (encrypted) {
        setUncloakStep(2);
      } else {
        // Plaintext payload - decode immediately
        executeUncloak("");
      }
    } catch (e: any) {
      setUncloakError(e.message || "Failed to parse invisible payload.");
    }
  };

  const executeUncloak = async (pass: string) => {
    setUncloakLoading(true);
    setUncloakError("");
    try {
      const secret = await decloak(uncloakPayload, pass);
      setUncloakOutput(secret);
      setUncloakStep(3);
    } catch (e: any) {
      setUncloakError("Wrong password or corrupted payload");
    } finally {
      setUncloakLoading(false);
    }
  };

  const copyToClipboard = (text: string, setCopied: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTextFile = (text: string, filename: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-neutral-800 text-neutral-300 flex flex-col items-center p-4 md:p-8 font-sans selection:bg-primary-500/30 selection:text-primary-200">
      {/* GitHub link */}
      <a
        href="https://github.com/cryptic-noodle/stegcloak-revived"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View source on GitHub"
        className="fixed top-4 right-4 z-50 p-2.5 rounded-full bg-neutral-900/80 border border-neutral-700/50 text-neutral-300 hover:text-neutral hover:border-primary-500/50 hover:bg-neutral-900 shadow-lg backdrop-blur transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
          <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.43-2.7 5.4-5.28 5.69.42.36.78 1.07.78 2.17 0 1.57-.01 2.83-.01 3.22 0 .31.21.67.8.56A10.99 10.99 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
        </svg>
      </a>

      {/* Container */}
      <div className="w-full max-w-2xl flex flex-col gap-6">
        
        {/* Header */}
        <header className="text-center py-6 flex flex-col items-center gap-2">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-primary-600 to-secondary-500 shadow-lg shadow-primary-500/20 animate-pulse">
            <Lock className="w-8 h-8 text-neutral" />
          </div>
          <h1 className="text-3xl font-extrabold text-neutral tracking-tight mt-2">
            StegCloak <span className="bg-gradient-to-r from-primary-400 to-secondary-400 bg-clip-text text-transparent">Revived</span>
          </h1>
          <p className="text-sm text-neutral-400 max-w-md">
            Hide encrypted secrets inside plain visible text using invisible Zero-Width Unicode characters. 100% offline.
          </p>
        </header>

        {/* Tab selection */}
        <div className="flex bg-neutral-900 p-1.5 rounded-xl border border-neutral-700/50 shadow-inner">
          <button
            onClick={() => setActiveTab("cloak")}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
              activeTab === "cloak"
                ? "bg-primary-600 text-neutral shadow-md shadow-primary-600/10"
                : "text-neutral-400 hover:text-neutral hover:bg-neutral-800/50"
            }`}
          >
            <Lock className="w-4 h-4" />
            Cloak Secret
          </button>
          <button
            onClick={() => setActiveTab("uncloak")}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
              activeTab === "uncloak"
                ? "bg-primary-600 text-neutral shadow-md shadow-primary-600/10"
                : "text-neutral-400 hover:text-neutral hover:bg-neutral-800/50"
            }`}
          >
            <Unlock className="w-4 h-4" />
            Uncloak Payload
          </button>
        </div>

        {/* Tab Content: Cloak */}
        {activeTab === "cloak" && (
          <div className="flex flex-col gap-6">
            
            {/* Step 1: Input Secret */}
            <div className={`p-5 rounded-2xl border transition-all duration-300 ${
              cloakStep === 1 
                ? "bg-neutral-700/30 border-primary-500/30 shadow-lg shadow-primary-500/5" 
                : "bg-neutral-700/10 border-neutral-700/50 opacity-60"
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  cloakStep > 1 ? "bg-secondary-600 text-neutral" : "bg-primary-600 text-neutral"
                }`}>1</span>
                <h3 className="font-bold text-neutral-100">Enter Secret Message</h3>
              </div>

              {cloakStep === 1 && (
                <div className="flex flex-col gap-3">
                  <textarea
                    rows={4}
                    placeholder="Type the secret message you want to hide..."
                    value={cloakSecret}
                    onChange={(e) => setCloakSecret(e.target.value)}
                    className="w-full bg-neutral-900 text-neutral-100 rounded-xl p-3 border border-neutral-700 focus:outline-none focus:border-primary-500 font-mono text-sm placeholder:text-neutral-500 resize-none transition"
                  />
                  <div className="flex justify-between items-center text-xs text-neutral-400">
                    <span>{cloakSecret.length} characters</span>
                    {cloakSecret.length > 0 && (
                      <span className="flex items-center gap-1 text-secondary-400">
                        <Sparkles className="w-3.5 h-3.5" />
                        Est. footprint: ~{getZwcEstimate(cloakSecret)} invisible characters
                      </span>
                    )}
                  </div>
                  <button
                    disabled={!cloakSecret.trim()}
                    onClick={() => setCloakStep(2)}
                    className="w-full py-2.5 rounded-xl font-bold bg-primary-600 text-neutral hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    Continue to Cover Text
                  </button>
                </div>
              )}

              {cloakStep > 1 && (
                <p className="text-sm text-neutral-400 pl-10 font-mono truncate max-w-md">
                  {cloakSecret || "Empty message"}
                </p>
              )}
            </div>

            {/* Step 2: Cover Text */}
            <div className={`p-5 rounded-2xl border transition-all duration-300 ${
              cloakStep === 2 
                ? "bg-neutral-700/30 border-primary-500/30 shadow-lg shadow-primary-500/5" 
                : cloakStep < 2 ? "bg-neutral-700/5 border-neutral-700/20 opacity-40 pointer-events-none" : "bg-neutral-700/10 border-neutral-700/50 opacity-60"
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  cloakStep > 2 ? "bg-secondary-600 text-neutral" : "bg-primary-600 text-neutral"
                }`}>2</span>
                <h3 className="font-bold text-neutral-100">Specify Cover Text</h3>
              </div>

              {cloakStep === 2 && (
                <div className="flex flex-col gap-3">
                  <textarea
                    rows={3}
                    placeholder="Enter the public text to embed the secret inside (Minimum 2 words)..."
                    value={cloakCover}
                    onChange={(e) => setCloakCover(e.target.value)}
                    className="w-full bg-neutral-900 text-neutral-100 rounded-xl p-3 border border-neutral-700 focus:outline-none focus:border-primary-500 text-sm placeholder:text-neutral-500 resize-none transition"
                  />
                  <div className="flex justify-between items-center text-xs text-neutral-400">
                    <span>{cloakCover.split(" ").filter(Boolean).length} words</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCloakStep(1)}
                      className="flex-1 py-2.5 rounded-xl font-bold bg-neutral-700 text-neutral hover:bg-neutral-600 transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      disabled={cloakCover.split(" ").filter(Boolean).length < 2}
                      onClick={() => setCloakStep(3)}
                      className="flex-1 py-2.5 rounded-xl font-bold bg-primary-600 text-neutral hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {cloakStep > 2 && (
                <p className="text-sm text-neutral-400 pl-10 truncate max-w-md">
                  {cloakCover}
                </p>
              )}
            </div>

            {/* Step 3: Security & Encryption */}
            <div className={`p-5 rounded-2xl border transition-all duration-300 ${
              cloakStep === 3 
                ? "bg-neutral-700/30 border-primary-500/30 shadow-lg shadow-primary-500/5" 
                : cloakStep < 3 ? "bg-neutral-700/5 border-neutral-700/20 opacity-40 pointer-events-none" : "bg-neutral-700/10 border-neutral-700/50 opacity-60"
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  cloakStep > 3 ? "bg-secondary-600 text-neutral" : "bg-primary-600 text-neutral"
                }`}>3</span>
                <h3 className="font-bold text-neutral-100">Encryption Options</h3>
              </div>

              {cloakStep === 3 && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between bg-neutral-900/50 p-3 rounded-xl border border-neutral-700/30">
                    <div>
                      <h4 className="text-sm font-semibold text-neutral-200">Password Encryption</h4>
                      <p className="text-xs text-neutral-500">Secure the payload using Argon2id + XChaCha20-Poly1305</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={usePassword}
                        onChange={(e) => setUsePassword(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-100 after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  {usePassword && (
                    <div className="relative">
                      <input
                        type={showCloakPass ? "text" : "password"}
                        placeholder="Enter encryption password..."
                        value={cloakPassword}
                        onChange={(e) => setCloakPassword(e.target.value)}
                        className="w-full bg-neutral-900 text-neutral-100 rounded-xl p-3 pr-10 border border-neutral-700 focus:outline-none focus:border-primary-500 text-sm placeholder:text-neutral-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCloakPass(!showCloakPass)}
                        className="absolute right-3 top-3 text-neutral-500 hover:text-neutral cursor-pointer"
                      >
                        {showCloakPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setCloakStep(2)}
                      className="flex-1 py-2.5 rounded-xl font-bold bg-neutral-700 text-neutral hover:bg-neutral-600 transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      disabled={cloakLoading || (usePassword && !cloakPassword)}
                      onClick={executeCloak}
                      className="flex-1 py-2.5 rounded-xl font-bold bg-primary-600 text-neutral hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {cloakLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Deriving Key...
                        </>
                      ) : (
                        "Generate Payload"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {cloakStep > 3 && (
                <div className="flex gap-2 pl-10">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-900/40 text-primary-300 font-semibold border border-primary-500/20">
                    Encryption: {usePassword ? "ON" : "OFF"}
                  </span>
                </div>
              )}
            </div>

            {/* Step 4: Output Result */}
            {cloakStep === 4 && (
              <div className="p-5 rounded-2xl border border-secondary-500/30 bg-neutral-700/30 shadow-lg shadow-secondary-500/5 animate-fade-in">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs bg-secondary-600 text-neutral">4</span>
                  <h3 className="font-bold text-neutral-100">Cloaked Text Ready</h3>
                </div>

                <div className="flex flex-col gap-3 pl-10">
                  <div className="relative bg-neutral-900 rounded-xl p-3.5 border border-neutral-700 min-h-[80px] text-sm break-all text-neutral-200">
                    {cloakOutput}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => copyToClipboard(cloakOutput, setCloakCopied)}
                      className="flex-1 py-2.5 rounded-xl font-bold bg-primary-600 text-neutral hover:bg-primary-700 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {cloakCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {cloakCopied ? "Copied!" : "Copy Result"}
                    </button>
                    <button
                      onClick={() => downloadTextFile(cloakOutput, "stegcloak-cloaked.txt")}
                      className="py-2.5 px-4 rounded-xl font-bold bg-neutral-700 text-neutral hover:bg-neutral-600 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      TXT
                    </button>
                  </div>
                  <button
                    onClick={handleCloakReset}
                    className="w-full mt-2 py-2 text-xs text-neutral-500 hover:text-neutral transition underline"
                  >
                    Reset & Start New Cloak
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Uncloak */}
        {activeTab === "uncloak" && (
          <div className="flex flex-col gap-6">
            
            {/* Step 1: Paste Payload */}
            <div className={`p-5 rounded-2xl border transition-all duration-300 ${
              uncloakStep === 1 
                ? "bg-neutral-700/30 border-primary-500/30 shadow-lg shadow-primary-500/5" 
                : "bg-neutral-700/10 border-neutral-700/50 opacity-60"
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                  uncloakStep > 1 ? "bg-secondary-600 text-neutral" : "bg-primary-600 text-neutral"
                }`}>1</span>
                <h3 className="font-bold text-neutral-100">Paste Cloaked Text</h3>
              </div>

              {uncloakStep === 1 && (
                <div className="flex flex-col gap-3">
                  <textarea
                    rows={4}
                    placeholder="Paste the text containing hidden invisible payload..."
                    value={uncloakPayload}
                    onChange={(e) => setUncloakPayload(e.target.value)}
                    className="w-full bg-neutral-900 text-neutral-100 rounded-xl p-3 border border-neutral-700 focus:outline-none focus:border-primary-500 text-sm placeholder:text-neutral-500 resize-none transition"
                  />
                  {uncloakError && (
                    <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xl">
                      {uncloakError}
                    </div>
                  )}
                  <button
                    disabled={!uncloakPayload.trim()}
                    onClick={verifyUncloakPayload}
                    className="w-full py-2.5 rounded-xl font-bold bg-primary-600 text-neutral hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    Verify & Continue
                  </button>
                </div>
              )}

              {uncloakStep > 1 && (
                <p className="text-sm text-neutral-400 pl-10 truncate max-w-md">
                  {uncloakPayload}
                </p>
              )}
            </div>

            {/* Step 2: Password (Conditional) */}
            {uncloakStep === 2 && isEncrypted && (
              <div className="p-5 rounded-2xl border border-primary-500/30 bg-neutral-700/30 shadow-lg shadow-primary-500/5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs bg-primary-600 text-neutral">2</span>
                  <h3 className="font-bold text-neutral-100">Enter Password</h3>
                </div>

                <div className="flex flex-col gap-3 pl-10">
                  <div className="relative">
                    <input
                      type={showUncloakPass ? "text" : "password"}
                      placeholder="Enter payload decryption password..."
                      value={uncloakPassword}
                      onChange={(e) => setUncloakPassword(e.target.value)}
                      className="w-full bg-neutral-900 text-neutral-100 rounded-xl p-3 pr-10 border border-neutral-700 focus:outline-none focus:border-primary-500 text-sm placeholder:text-neutral-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowUncloakPass(!showUncloakPass)}
                      className="absolute right-3 top-3 text-neutral-500 hover:text-neutral cursor-pointer"
                    >
                      {showUncloakPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {uncloakError && (
                    <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xl">
                      {uncloakError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUncloakStep(1)}
                      className="flex-1 py-2.5 rounded-xl font-bold bg-neutral-700 text-neutral hover:bg-neutral-600 transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      disabled={uncloakLoading || !uncloakPassword}
                      onClick={() => executeUncloak(uncloakPassword)}
                      className="flex-1 py-2.5 rounded-xl font-bold bg-primary-600 text-neutral hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {uncloakLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Decrypting...
                        </>
                      ) : (
                        "Reveal Secret"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Decrypted Output */}
            {uncloakStep === 3 && (
              <div className="p-5 rounded-2xl border border-secondary-500/30 bg-neutral-700/30 shadow-lg shadow-secondary-500/5 animate-fade-in">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs bg-secondary-600 text-neutral">
                    {isEncrypted ? 3 : 2}
                  </span>
                  <h3 className="font-bold text-neutral-100">Revealed Secret</h3>
                </div>

                <div className="flex flex-col gap-3 pl-10">
                  <div className="relative bg-neutral-900 rounded-xl p-3.5 border border-neutral-700 min-h-[80px] text-sm text-neutral-200 font-mono">
                    {uncloakOutput}
                  </div>
                  <button
                    onClick={() => copyToClipboard(uncloakOutput, setUncloakCopied)}
                    className="w-full py-2.5 rounded-xl font-bold bg-primary-600 text-neutral hover:bg-primary-700 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {uncloakCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {uncloakCopied ? "Copied!" : "Copy Secret"}
                  </button>
                  <button
                    onClick={handleUncloakReset}
                    className="w-full mt-2 py-2 text-xs text-neutral-500 hover:text-neutral transition underline"
                  >
                    Reset & Start New Reveal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer info */}
        <footer className="text-center py-6 text-xs text-neutral-500 flex flex-col items-center gap-3 border-t border-neutral-700/30 mt-6">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-primary-500" /> WebAssembly Crypto
            </span>
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-secondary-500" /> Offline-First PWA
            </span>
          </div>
          <p>© 2026 StegCloak Revived. All cryptography runs locally on your browser.</p>
        </footer>
      </div>
    </div>
  );
}
