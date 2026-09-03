import { useEffect, useState } from "react";

import {
  PRO_CHECKOUT_URL,
  activateLemonSqueezyLicense,
  clearProActivation,
  deactivateLemonSqueezyLicense,
  readStoredProLicense,
  storeProActivation,
} from "../lib/license.js";

export default function LicenseModal({
  isOpen,
  isActivated,
  onActivated,
  onClose,
  onDeactivated,
}) {
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const busy = activating || deactivating;

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [busy, isOpen, onClose]);

  useEffect(() => {
    if (isOpen) return;
    setError("");
    setSuccess("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window.createLemonSqueezy !== "function") return;
    window.createLemonSqueezy();
  }, [isOpen]);

  if (!isOpen) return null;

  const activate = async (event) => {
    event.preventDefault();
    setActivating(true);
    setError("");
    setSuccess("");
    try {
      const data = await activateLemonSqueezyLicense(licenseKey);
      const instanceId =
        data && data.instance && typeof data.instance.id === "string"
          ? data.instance.id
          : "";
      storeProActivation(true, { licenseKey, instanceId });
      setLicenseKey("");
      setSuccess("License activated. DocuFold Pro is ready to use.");
      onActivated();
      onClose();
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : "License activation failed. Try again.",
      );
    } finally {
      setActivating(false);
    }
  };

  const deactivate = async () => {
    setDeactivating(true);
    setError("");
    setSuccess("");
    try {
      const storedLicense = readStoredProLicense();
      await deactivateLemonSqueezyLicense(storedLicense);
      clearProActivation();
      onDeactivated();
      setSuccess("Device deactivated successfully.");
    } catch (deactivationError) {
      setError(
        deactivationError instanceof Error
          ? deactivationError.message
          : "License deactivation failed. Try again.",
      );
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="license-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="license-modal-title"
      >
        <button
          className="modal-close"
          type="button"
          aria-label="Close license dialog"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
        <span className="pro-kicker">DOCUFOLD PRO</span>
        <h2 id="license-modal-title">
          {isActivated ? "Manage Pro License" : "Activate Pro"}
        </h2>
        <p className="modal-intro">
          {isActivated
            ? "Manage the Pro activation assigned to this browser."
            : "Unlock watermark removal and advanced local PDF workflows. PDF files always stay on your device."}
        </p>

        {error && (
          <div className="license-message error" role="alert">
            {error}
          </div>
        )}
        {(success || isActivated) && (
          <div className="license-message success" role="status">
            {success || "DocuFold Pro is active in this browser."}
          </div>
        )}

        {isActivated ? (
          <div className="active-license-panel">
            <p>
              Deactivate this device to release its activation slot for
              another browser or device.
            </p>
            <button
              className="deactivate-license-button"
              type="button"
              disabled={deactivating}
              onClick={deactivate}
            >
              {deactivating ? "Deactivating…" : "Deactivate License"}
            </button>
          </div>
        ) : (
          <form onSubmit={activate}>
            <label htmlFor="license-key">License Key</label>
            <input
              id="license-key"
              type="text"
              value={licenseKey}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              onChange={(event) => setLicenseKey(event.target.value)}
            />
            <button
              className="activate-submit"
              type="submit"
              disabled={activating || licenseKey.trim().length === 0}
            >
              {activating ? "Activating…" : "Activate"}
            </button>
          </form>
        )}

        {!isActivated && <div className="purchase-row">
          <span>Need a license?</span>
          <a
            className="lemonsqueezy-button"
            href={PRO_CHECKOUT_URL}
          >
            Upgrade to Pro
          </a>
        </div>}
        <small className="license-privacy">
          {isActivated
            ? "Your license key and device ID are stored only in this browser so this activation can be released."
            : "Activation contacts Lemon Squeezy. Your license key and device ID are stored locally to support deactivation."}
        </small>
      </section>
    </div>
  );
}
