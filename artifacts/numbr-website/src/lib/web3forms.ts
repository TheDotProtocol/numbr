const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";

type Web3FormsPayload = Record<string, string | boolean | number>;

type Web3FormsResponse = {
  success: boolean;
  message?: string;
};

export async function submitWeb3Form(payload: Web3FormsPayload) {
  const accessKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY;

  if (!accessKey) {
    throw new Error(
      "Web3Forms is not configured. Add VITE_WEB3FORMS_ACCESS_KEY to your environment.",
    );
  }

  const response = await fetch(WEB3FORMS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      access_key: accessKey,
      from_name: "Numbr Website",
      botcheck: false,
      ...payload,
    }),
  });

  const result = (await response.json()) as Web3FormsResponse;

  if (!response.ok || !result.success) {
    throw new Error(result.message ?? "Unable to send your reservation right now.");
  }

  return result;
}
