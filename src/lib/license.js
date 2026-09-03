export const PRO_ACTIVATION_STORAGE_KEY = "docufold_is_pro";
export const PRO_LICENSE_KEY_STORAGE_KEY = "docufold_license_key";
export const PRO_INSTANCE_ID_STORAGE_KEY = "docufold_instance_id";
export const PRO_CHECKOUT_URL =
  "https://docufold.lemonsqueezy.com/checkout/buy/6e97edf7-08a7-4496-8656-bcc6dec2f699?embed=1&locale=en";

const LICENSE_ACTIVATION_URL =
  "https://api.lemonsqueezy.com/v1/licenses/activate";
const LICENSE_DEACTIVATION_URL =
  "https://api.lemonsqueezy.com/v1/licenses/deactivate";

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readProActivation() {
  const storage = browserStorage();
  if (!storage) return false;
  const activated = storage.getItem(PRO_ACTIVATION_STORAGE_KEY) === "true";
  if (!activated) return false;
  const { licenseKey, instanceId } = readStoredProLicense();
  if (!licenseKey || !instanceId) {
    clearProActivation();
    return false;
  }
  return true;
}

export function readStoredProLicense() {
  const storage = browserStorage();
  if (!storage) return { licenseKey: "", instanceId: "" };
  return {
    licenseKey: storage.getItem(PRO_LICENSE_KEY_STORAGE_KEY) || "",
    instanceId: storage.getItem(PRO_INSTANCE_ID_STORAGE_KEY) || "",
  };
}
export function clearProActivation() {
  const storage = browserStorage();
  if (!storage) return;
  storage.removeItem(PRO_ACTIVATION_STORAGE_KEY);
  storage.removeItem(PRO_LICENSE_KEY_STORAGE_KEY);
  storage.removeItem(PRO_INSTANCE_ID_STORAGE_KEY);
}

export function storeProActivation(isActivated, details = {}) {
  if (!isActivated) {
    clearProActivation();
    return;
  }

  const licenseKey =
    typeof details.licenseKey === "string" ? details.licenseKey.trim() : "";
  const instanceId =
    typeof details.instanceId === "string" ? details.instanceId.trim() : "";
  if (!licenseKey || !instanceId) {
    throw new Error("License activation details are incomplete.");
  }

  const storage = browserStorage();
  if (!storage) {
    throw new Error("License activation cannot be saved in this browser.");
  }
  storage.setItem(PRO_LICENSE_KEY_STORAGE_KEY, licenseKey);
  storage.setItem(PRO_INSTANCE_ID_STORAGE_KEY, instanceId);
  storage.setItem(PRO_ACTIVATION_STORAGE_KEY, "true");
}

function defaultInstanceName() {
  const hostname = window.location.hostname || "local";
  return "DocuFold Web (" + hostname + ")";
}

export async function activateLemonSqueezyLicense(
  licenseKey,
  {
    fetchImplementation = globalThis.fetch,
    instanceName = defaultInstanceName(),
  } = {},
) {
  const normalizedKey =
    typeof licenseKey === "string" ? licenseKey.trim() : "";
  if (!normalizedKey) {
    throw new Error("Enter your Lemon Squeezy license key.");
  }
  if (typeof fetchImplementation !== "function") {
    throw new Error("License activation is unavailable in this browser.");
  }

  const body = new URLSearchParams({
    license_key: normalizedKey,
    instance_name: instanceName,
  });
  let response;
  try {
    response = await fetchImplementation(LICENSE_ACTIVATION_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch {
    throw new Error(
      "We could not reach Lemon Squeezy. Check your connection and try again.",
    );
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Lemon Squeezy returned an unreadable response.");
  }
  if (!response.ok || result.activated !== true) {
    throw new Error(
      result.error || "This license key could not be activated.",
    );
  }
  return result;
}

export async function deactivateLemonSqueezyLicense(
  { licenseKey, instanceId },
  { fetchImplementation = globalThis.fetch } = {},
) {
  const normalizedKey =
    typeof licenseKey === "string" ? licenseKey.trim() : "";
  const normalizedInstanceId =
    typeof instanceId === "string" ? instanceId.trim() : "";
  if (!normalizedKey || !normalizedInstanceId) {
    throw new Error(
      "This browser is missing the license details required to deactivate this device.",
    );
  }
  if (typeof fetchImplementation !== "function") {
    throw new Error("License deactivation is unavailable in this browser.");
  }

  const body = new URLSearchParams({
    license_key: normalizedKey,
    instance_id: normalizedInstanceId,
  });
  let response;
  try {
    response = await fetchImplementation(LICENSE_DEACTIVATION_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch {
    throw new Error(
      "We could not reach Lemon Squeezy. Check your connection and try again.",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Lemon Squeezy returned an unreadable response.");
  }
  if (!response.ok || result.deactivated !== true) {
    throw new Error(
      result.error || "This device could not be deactivated.",
    );
  }
  return result;
}
