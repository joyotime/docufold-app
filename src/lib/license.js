export const PRO_ACTIVATION_STORAGE_KEY = "is_pro_activated";
export const PRO_CHECKOUT_URL =
  "https://docufold.lemonsqueezy.com/checkout/buy/6e97edf7-08a7-4496-8656-bcc6dec2f699";

const LICENSE_ACTIVATION_URL =
  "https://api.lemonsqueezy.com/v1/licenses/activate";

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
  const stored = storage.getItem(PRO_ACTIVATION_STORAGE_KEY);
  if (stored === null) {
    storage.setItem(PRO_ACTIVATION_STORAGE_KEY, "false");
    return false;
  }
  return stored === "true";
}

export function storeProActivation(isActivated) {
  const storage = browserStorage();
  if (!storage) return;
  storage.setItem(
    PRO_ACTIVATION_STORAGE_KEY,
    isActivated ? "true" : "false",
  );
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
