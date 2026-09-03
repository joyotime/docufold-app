import { useEffect, useState } from "react";

import {
  PRO_CHECKOUT_URL,
  activateLemonSqueezyLicense,
  storeProActivation,
} from "../lib/license.js";

export default function LicenseModal({
  isOpen,
  isActivated,
  onActivated,
  onClose,
}) {
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !activating) onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [activating, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setSuccess(
      isActivated ? "DocuFold Pro is active in this browser." : "",
    );
  }, [isActivated, isOpen]);

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
      await activateLemonSqueezyLicense(licenseKey);
      storeProActivation(true);
      setLicenseKey("");
      setSuccess("License activated. DocuFold Pro is ready to use.");
      onActivated();
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

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !activating) onClose();
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
          aria-label="Close activation dialog"
          disabled={activating}
          onClick={onClose}
        >
          ×
        </button>
        <span className="pro-kicker">DOCUFOLD PRO</span>
        <h2 id="license-modal-title">Activate Pro</h2>
        <p className="modal-intro">
          Unlock watermark removal and advanced local PDF workflows. PDF files
          always stay on your device.
        </p>

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
          {error && (
            <div className="license-message error" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="license-message success" role="status">
              {success}
            </div>
          )}
          <button
            className="activate-submit"
            type="submit"
            disabled={activating || licenseKey.trim().length === 0}
          >
            {activating ? "Activating…" : "Activate"}
          </button>
        </form>

        <div className="purchase-row">
          <span>Need a license?</span>
          <a
            className="lemonsqueezy-button"
            href={PRO_CHECKOUT_URL}
          >
            Upgrade to Pro
          </a>
        </div>
        <small className="license-privacy">
          Activation contacts Lemon Squeezy. Your license key is not stored;
          only the local Pro status is saved.
        </small>
      </section>
    </div>
  );
}
